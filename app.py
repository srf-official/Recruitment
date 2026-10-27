"""TurnB Recruitment Platform. Admin credentials and all assessment data stay server-side."""
import copy
import hashlib
import hmac
import io
import logging
import math
import os
import secrets
import threading
import time
import uuid
from datetime import timedelta
from functools import wraps
from openpyxl import load_workbook

from flask import Flask, jsonify, request, send_file, session
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash

from configuration import update_configuration
from domain import (DURATIONS, RuleError, clean_text, grade, require,
                    public_questions, responses_validated, student_key)
from exports import excel, filename, results_rows, words
from store import Store, attempts, login_limits, now_ms


def create_app(settings=None):
    app = Flask(__name__, static_folder='static')
    app.config.update(SECRET_KEY=os.environ.get('SESSION_SECRET') or secrets.token_urlsafe(48),
                      ADMIN_EMAIL=os.environ.get('ADMIN_EMAIL', 'turnbrecruitment@gmail.com'),
                      ADMIN_PASSWORD_HASH=os.environ.get('ADMIN_PASSWORD_HASH', ''),
                      DATABASE_URL=os.environ.get('DATABASE_URL', ''),
                      PUBLIC_ORIGIN=os.environ.get('PUBLIC_ORIGIN', ''),
                      APP_ENV=os.environ.get('APP_ENV', 'production'),
                      CONFIGURED_SECRET=bool(os.environ.get('SESSION_SECRET')),
                      SESSION_COOKIE_NAME='turnb_admin', SESSION_COOKIE_HTTPONLY=True,
                      SESSION_COOKIE_SECURE=True, SESSION_COOKIE_SAMESITE='Strict',
                      PERMANENT_SESSION_LIFETIME=timedelta(hours=8), MAX_CONTENT_LENGTH=8 * 1024 * 1024)
    if settings:
        app.config.update(settings)
    local = app.config['APP_ENV'] in {'test', 'development'}
    if local:
        app.config['SESSION_COOKIE_SECURE'] = False
    store = None
    if app.config['DATABASE_URL']:
        store = Store(app.config['DATABASE_URL'], testing=local)
        if local:
            store.initialize()
    app.extensions['store'] = store

    def ready():
        return store is not None and (local or app.config['CONFIGURED_SECRET'] and len(app.secret_key) >= 32) and bool(app.config['ADMIN_PASSWORD_HASH'])

    def db_required():
        if not ready():
            return jsonify(error='The application requires database and administrator configuration.'), 503
        return None

    def admin(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            if not session.get('admin'):
                return jsonify(error='Administrator login required.'), 401
            return function(*args, **kwargs)
        return wrapped

    @app.before_request
    def security():
        if request.path.startswith('/api/'):
            problem = db_required()
            if problem:
                return problem
            if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
                is_aptitude_import = (request.path.startswith('/api/admin/drives/') and
                                      request.path.endswith('/aptitude/import'))
                if request.mimetype != 'application/json' and not (is_aptitude_import and request.mimetype == 'multipart/form-data'):
                    return jsonify(error='JSON request required.'), 415
                expected = session.get('csrf')
                if not expected or not hmac.compare_digest(request.headers.get('X-CSRF-Token', ''), expected):
                    return jsonify(error='Refresh the page and try again.'), 403
                origin = request.headers.get('Origin')
                allowed = app.config['PUBLIC_ORIGIN'] or request.host_url.rstrip('/')
                if origin and origin != allowed:
                    return jsonify(error='Origin not allowed.'), 403

    @app.after_request
    def response_headers(response):
        response.headers.update({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                                 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
                                 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
                                 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"})
        if not local:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        return response

    @app.errorhandler(RuleError)
    def invalid(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        app.logger.error('Database operation failed: %s', type(error).__name__)
        return jsonify(error='Storage is temporarily unavailable. Please retry; do not close your test.'), 503

    @app.errorhandler(Exception)
    def unexpected(error):
        if isinstance(error, HTTPException):
            return jsonify(error=error.description), error.code
        app.logger.error('Request failed: %s', type(error).__name__)
        return jsonify(error='The request could not be completed. Please retry.'), 500

    @app.get('/')
    @app.get('/test/<test_id>')
    def index(test_id=None):
        return app.send_static_file('index.html')

    @app.get('/healthz')
    def health():
        return jsonify(status='ok', service='turnb-recruitment')

    @app.get('/readyz')
    def readiness():
        if not ready():
            return jsonify(status='configuration-required'), 503
        with store.transaction():
            pass
        return jsonify(status='ready')

    @app.get('/api/auth/session')
    def auth_session():
        session.setdefault('csrf', secrets.token_urlsafe(32))
        return jsonify(admin=bool(session.get('admin')), csrf=session['csrf'])

    @app.post('/api/auth/login')
    def login():
        data = request.get_json()
        require(isinstance(data, dict), 'Invalid login.')
        email = clean_text(data.get('email', ''), 200, 'email').casefold()
        password = data.get('password', '')
        require(isinstance(password, str) and len(password) <= 1024, 'Invalid password.')
        # Azure terminates ingress; use the last forwarded address, not a user-supplied first one.
        address = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[-1].strip()
        bucket = hmac.new(app.secret_key.encode(), address.encode(), hashlib.sha256).hexdigest()
        timestamp = now_ms()
        with store.transaction() as tx:
            tx.connection.execute(delete(login_limits).where(login_limits.c.window < timestamp - 900000))
            row = tx.connection.execute(select(login_limits).where(login_limits.c.id == bucket)).mappings().first()
            if row and row['count'] >= 5:
                return jsonify(error='Too many login attempts. Try again in 15 minutes.'), 429
            if row:
                tx.connection.execute(update(login_limits).where(login_limits.c.id == bucket).values(count=row['count'] + 1))
            else:
                tx.connection.execute(insert(login_limits).values(id=bucket, window=timestamp, count=1))
        valid_hash = check_password_hash(app.config['ADMIN_PASSWORD_HASH'], password)
        if not (valid_hash and hmac.compare_digest(email, app.config['ADMIN_EMAIL'].casefold())):
            return jsonify(error='Email or password is incorrect.'), 401
        with store.transaction() as tx:
            tx.connection.execute(delete(login_limits).where(login_limits.c.id == bucket))
        session.clear()
        session.update(admin=True, csrf=secrets.token_urlsafe(32))
        session.permanent = True
        return jsonify(admin=True, csrf=session['csrf'])

    @app.post('/api/auth/logout')
    def logout():
        session.clear()
        return jsonify(ok=True)

    @app.get('/api/admin/state')
    @admin
    def get_state():
        with store.transaction() as tx:
            tx.expire()
            return jsonify(state=tx.export_state(), revision=tx.next_version(), serverNow=now_ms())

    @app.put('/api/admin/state')
    @admin
    def put_state():
        payload = request.get_json()
        require(isinstance(payload, dict), 'Invalid request.')
        with store.transaction() as tx:
            tx.expire()
            if payload.get('revision') != tx.next_version():
                return jsonify(error='Another change was saved. Reload before continuing.'), 409
            update_configuration(tx, payload.get('state'))
            return jsonify(revision=tx.next_version(), state=tx.export_state(), serverNow=now_ms())

    def test_required(tx, test_id):
        test = tx.test(test_id)
        require(test is not None, 'This test link is unavailable.')
        return test

    @app.post('/api/admin/drives/<drive_id>/aptitude/import')
    @admin
    def import_aptitude_results(drive_id):
        uploaded = request.files.get('file')
        require(uploaded is not None and uploaded.filename.lower().endswith('.xlsx'),
                'Choose the Aptitude score tracker as an .xlsx file.')
        try:
            workbook = load_workbook(io.BytesIO(uploaded.read()), read_only=True, data_only=True)
            sheet = next((ws for ws in workbook.worksheets if ws.title.strip().casefold() == 'shortlist'), None)
            require(sheet is not None, 'The workbook must contain a sheet named Shortlist.')
            headers = [str(value or '').strip().casefold() for value in next(sheet.iter_rows(min_row=1, max_row=1, values_only=True))]
            expected = ['full name', 'student id', 'marks obtained', 'time taken (minutes)']
            require(headers[:4] == expected, 'Shortlist columns must be Full Name, Student ID, Marks Obtained, and Time Taken (Minutes), in that order.')
            records, seen = [], set()
            for row_number, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                values = list(row[:4])
                if not any(value not in (None, '') for value in values):
                    continue
                require(len(values) == 4 and all(value not in (None, '') for value in values),
                        f'Complete all four Shortlist fields on row {row_number}.')
                name = clean_text(str(values[0]), 100, 'candidate name')
                student_id = clean_text(str(values[1]), 60, 'student ID')
                require(name and student_id, f'Name and student ID are required on row {row_number}.')
                try:
                    score, elapsed = float(values[2]), float(values[3])
                except (TypeError, ValueError):
                    raise RuleError(f'Marks and time must be numeric on row {row_number}.')
                require(math.isfinite(score) and 0 <= score <= 30, f'Marks must be between 0 and 30 on row {row_number}.')
                require(math.isfinite(elapsed) and 0 <= elapsed <= 1440, f'Time must be between 0 and 1440 minutes on row {row_number}.')
                key = student_key(student_id)
                require(key not in seen, f'Duplicate student ID on row {row_number}.')
                seen.add(key)
                records.append({'name': name, 'studentId': student_id,
                                'importedScore': round(score, 4),
                                'importedElapsedMinutes': round(elapsed, 4)})
                require(len(records) <= 2000, 'The Shortlist sheet exceeds the 2,000 candidate limit.')
            workbook.close()
        except RuleError:
            raise
        except Exception:
            raise RuleError('The workbook could not be read. Save it as a valid .xlsx file and try again.')
        require(records, 'The Shortlist sheet contains no candidate rows.')
        with store.transaction() as tx:
            drive = next((d for d in tx.state['drives'] if d['id'] == drive_id), None)
            require(drive is not None, 'Drive not found.')
            require(not drive.get('finishedAt'), 'Cannot import results into a finished drive.')
            require(not any(s['driveId'] == drive_id and s['type'] == 'aptitude' for s in tx.state['sessions']),
                    'This drive already has an Aptitude session. Import is allowed only once.')
            now = now_ms()
            test_id = str(uuid.uuid4())
            test = {'id': test_id, 'driveId': drive_id, 'type': 'aptitude',
                    'name': drive['name'] + ' · Aptitude', 'start': now, 'closedAt': now,
                    'endReason': 'imported', 'historicalImport': True, 'questions': []}
            tx.state['sessions'].insert(0, test)
            for record in records:
                elapsed_ms = int(record['importedElapsedMinutes'] * 60000)
                started = now - elapsed_ms
                attempt = {'id': str(uuid.uuid4()), **record, 'startedAt': started,
                           'deadline': started + 15 * 60000, 'submittedAt': now,
                           'reason': 'imported', 'responses': {}, 'sequence': 0,
                           'manualMarks': {}, 'shortlisted': True,
                           'importedSource': 'Shortlist'}
                key_hash = hashlib.sha256(student_key(record['studentId']).encode()).hexdigest()
                token_hash = hashlib.sha256(secrets.token_bytes(32)).hexdigest()
                tx.add_attempt(test_id, attempt, key_hash, token_hash)
            return jsonify(imported=len(records), testId=test_id, serverNow=now)

    def candidate_attempt(tx, test):
        token = request.cookies.get('attempt_' + test['id'], '')
        require(token and len(token) <= 200, 'Start the test in this browser first.')
        digest = hashlib.sha256(token.encode()).hexdigest()
        for a in tx.all_attempts(test['id']):
            if hmac.compare_digest(tx.loaded[a['id']]['row']['token_hash'], digest):
                return a
        raise RuleError('Attempt credentials are invalid.')

    def matching_token(test_id, attempt_id, qid, index):
        value = f'{test_id}:{attempt_id}:{qid}:{index}'
        return hmac.new(app.secret_key.encode(), value.encode(), hashlib.sha256).hexdigest()[:32]

    def candidate_payload(test, attempt=None):
        public = {k: test[k] for k in ('id', 'type', 'name', 'driveId', 'closedAt')}
        public['durationMinutes'] = DURATIONS[test['type']]
        public['questionCount'] = len(test['questions'])
        if attempt is not None:
            signer = lambda qid, i: matching_token(test['id'], attempt['id'], qid, i)
            public['questions'] = public_questions(test['questions'], signer)
            candidate = {k: copy.deepcopy(v) for k, v in attempt.items() if k not in {'manualMarks', 'shortlisted'}}
            for q in test['questions']:
                if q['type'] == 'matching' and q['id'] in candidate['responses']:
                    candidate['responses'][q['id']] = [None if i is None else signer(q['id'], i) for i in candidate['responses'][q['id']]]
            public['attempts'] = [candidate]
        else:
            public['questions'], public['attempts'] = [], []
        return {'test': public, 'serverNow': now_ms()}

    @app.get('/api/candidate/<test_id>')
    def get_candidate(test_id):
        with store.transaction() as tx:
            test = test_required(tx, test_id)
            tx.expire(test_id)
            a = candidate_attempt(tx, test) if request.cookies.get('attempt_' + test_id) else None
            return jsonify(candidate_payload(test, a))

    @app.post('/api/candidate/<test_id>/start')
    def start_candidate(test_id):
        data = request.get_json()
        require(isinstance(data, dict), 'Invalid candidate details.')
        name, student = clean_text(data.get('name'), 100, 'name'), clean_text(data.get('studentId'), 60, 'student ID')
        require(name and student, 'Name and student ID are required.')
        with store.transaction() as tx:
            test = test_required(tx, test_id)
            tx.expire(test_id)
            require(not test.get('closedAt'), 'This test has ended.')
            if request.cookies.get('attempt_' + test_id):
                return jsonify(candidate_payload(test, candidate_attempt(tx, test)))
            require(test['questions'], 'Questions are not configured yet.')
            key = student_key(student)
            require(not any(student_key(a['studentId']) == key for a in tx.all_attempts(test_id)), 'This student ID already has an attempt. Use the original browser to continue.')
            token, now = secrets.token_urlsafe(48), now_ms()
            a = {'id': str(uuid.uuid4()), 'name': name, 'studentId': student, 'startedAt': now,
                 'deadline': now + DURATIONS[test['type']] * 60000, 'responses': {}, 'sequence': 0,
                 'submittedAt': None, 'reason': None, 'manualMarks': {}, 'shortlisted': False}
            tx.add_attempt(test_id, a, hashlib.sha256(key.encode()).hexdigest(), hashlib.sha256(token.encode()).hexdigest())
            response = jsonify(candidate_payload(test, a))
            response.set_cookie('attempt_' + test_id, token, httponly=True, secure=not local,
                                samesite='Strict', path='/api/candidate/' + test_id, max_age=86400)
            return response

    @app.post('/api/candidate/<test_id>/answer')
    def candidate_answer(test_id):
        data = request.get_json()
        require(isinstance(data, dict), 'Invalid answer.')
        with store.transaction() as tx:
            test = test_required(tx, test_id)
            a = candidate_attempt(tx, test)
            tx.expire(test_id)
            if not a.get('submittedAt') and not test.get('closedAt'):
                sequence = data.get('sequence')
                require(type(sequence) is int and 0 < sequence < 2**31, 'Invalid save sequence.')
                if sequence > a['sequence']:
                    responses = copy.deepcopy(data.get('responses', {}))
                    require(isinstance(responses, dict), 'Invalid response object.')
                    for q in test['questions']:
                        if q['type'] == 'matching' and q['id'] in responses:
                            tokens = {matching_token(test['id'], a['id'], q['id'], i): i for i in range(len(q['pairs']))}
                            values = responses[q['id']]
                            require(isinstance(values, list) and all(v is None or isinstance(v, str) and v in tokens for v in values), 'Invalid matching choice.')
                            responses[q['id']] = [None if v is None else tokens[v] for v in values]
                    a['responses'] = responses_validated(test['questions'], responses)
                    a['sequence'] = sequence
                if data.get('submit') is True:
                    a.update(submittedAt=now_ms(), reason='manual')
                tx.expire(test_id)
            return jsonify(candidate_payload(test, a))

    def filter_numbers(data):
        values = []
        for field in ('minMarks', 'minTime'):
            value = data.get(field)
            if value is None or value == '':
                values.append(None)
                continue
            try:
                number = float(value)
            except (ValueError, TypeError):
                raise RuleError('Invalid numeric filter.')
            require(math.isfinite(number) and (field != 'minTime' or number >= 0), 'Invalid filter range.')
            values.append(number)
        return values

    @app.post('/api/admin/tests/<test_id>/shortlist')
    @admin
    def shortlist(test_id):
        data = request.get_json()
        require(isinstance(data, dict), 'Invalid request.')
        with store.transaction() as tx:
            test = test_required(tx, test_id)
            require(test['type'] != 'prompt', 'Prompt Engineering is evaluated separately.')
            tx.expire(test_id)
            rows = results_rows(test, tx.all_attempts(test_id), *filter_numbers(data))
            changed, skipped = 0, 0
            for a, g, _ in rows:
                if data.get('attemptId') and a['id'] != data['attemptId']:
                    continue
                if not a.get('submittedAt') or g['pending']:
                    skipped += 1
                    continue
                a['shortlisted'] = data.get('value', True) is True
                changed += 1
            return jsonify(changed=changed, skipped=skipped)

    @app.post('/api/admin/drives/<drive_id>/delete')
    @admin
    def delete_drive(drive_id):
        data = request.get_json()
        require(isinstance(data, dict) and data.get('confirm') is True, 'Confirm drive deletion.')
        with store.transaction() as tx:
            drive = next((d for d in tx.state['drives'] if d['id'] == drive_id), None)
            require(drive is not None, 'Drive not found.')
            test_ids = [s['id'] for s in tx.state['sessions'] if s['driveId'] == drive_id]
            if test_ids:
                tx.connection.execute(delete(attempts).where(attempts.c.test_id.in_(test_ids)))
            tx.state['sessions'] = [s for s in tx.state['sessions'] if s['driveId'] != drive_id]
            tx.state['drives'] = [d for d in tx.state['drives'] if d['id'] != drive_id]
            return jsonify(deleted=True, tests=len(test_ids))

    @app.post('/api/admin/drives/<drive_id>/gd/pools')
    @admin
    def generate_gd_pools(drive_id):
        data = request.get_json()
        require(isinstance(data, dict) and type(data.get('poolSize')) is int and 1 <= data['poolSize'] <= 100, 'Pool size must be between 1 and 100.')
        with store.transaction() as tx:
            drive = next((d for d in tx.state['drives'] if d['id'] == drive_id), None)
            require(drive is not None, 'Drive not found.')
            aptitude = next((s for s in tx.state['sessions'] if s['driveId'] == drive_id and s['type'] == 'aptitude'), None)
            require(aptitude is not None, 'Generate the Aptitude link before creating GD pools.')
            tx.expire(aptitude['id'])
            aptitude_attempts = tx.all_attempts(aptitude['id'])
            require(aptitude.get('closedAt') or all(a.get('submittedAt') for a in aptitude_attempts), 'Finish Aptitude before generating GD pools.')
            selected = {}
            for candidate in aptitude_attempts:
                if candidate.get('shortlisted') and candidate.get('submittedAt'):
                    key = student_key(candidate['studentId'])
                    prior = selected.get(key)
                    if prior is None or candidate.get('startedAt', 0) > prior.get('startedAt', 0):
                        selected[key] = {'studentId': candidate['studentId'], 'name': candidate['name']}
            roster = sorted(selected.items(), key=lambda pair: (pair[1]['name'].casefold(), pair[1]['studentId'].casefold()))
            count = max(1, len(roster) // data['poolSize'])
            pools = []
            for index in range(count):
                start = index * data['poolSize']
                end = (index + 1) * data['poolSize'] if index < count - 1 else len(roster)
                pools.append({'name': f'Pool {chr(65 + index)}' if index < 26 else f'Pool {index + 1}', 'members': [key for key, _ in roster[start:end]]})
            previous = drive.get('gd') or {}
            drive['gd'] = {'poolSize': data['poolSize'], 'pools': pools, 'candidates': {key: person for key, person in roster}, 'scores': previous.get('scores', {}), 'updatedAt': now_ms()}
            return jsonify(gd=drive['gd'], candidateCount=len(roster))

    @app.post('/api/admin/drives/<drive_id>/gd/score')
    @admin
    def save_gd_score(drive_id):
        data = request.get_json()
        require(isinstance(data, dict), 'Invalid score request.')
        field = data.get('field')
        require(field in {'initiative', 'content', 'communication', 'bodyLanguage'}, 'Invalid GD scoring area.')
        value = data.get('score')
        require(value is None or (type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 5), 'Enter a score from 0 to 5.')
        with store.transaction() as tx:
            drive = next((d for d in tx.state['drives'] if d['id'] == drive_id), None)
            require(drive is not None and isinstance(drive.get('gd'), dict), 'Generate GD pools first.')
            key = data.get('studentKey')
            allowed = {member for pool in drive['gd']['pools'] for member in pool['members']}
            require(key in allowed, 'Candidate is not in this drive’s GD pools.')
            score = drive['gd'].setdefault('scores', {}).setdefault(key, {})
            if value is None:
                score.pop(field, None)
            else:
                score[field] = float(value)
            score['total'] = round(sum(score.get(name, 0) for name in ('initiative', 'content', 'communication', 'bodyLanguage')), 2)
            drive['gd']['updatedAt'] = now_ms()
            return jsonify(score=score, serverNow=now_ms())

    @app.post('/api/admin/tests/<test_id>/marks')
    @admin
    def mark(test_id):
        data = request.get_json()
        require(isinstance(data, dict), 'Invalid request.')
        with store.transaction() as tx:
            test = test_required(tx, test_id)
            require(test['type'] != 'prompt', 'Prompt Engineering is evaluated separately.')
            a = next((a for a in tx.all_attempts(test_id) if a['id'] == data.get('attemptId')), None)
            q = next((q for q in test['questions'] if q['id'] == data.get('questionId')), None)
            require(a and q and a.get('submittedAt'), 'Submitted candidate/question not found.')
            value = data.get('score')
            if value is None:
                a['manualMarks'].pop(q['id'], None)
            else:
                require(type(value) in (int, float) and math.isfinite(value) and q['wrongScore'] <= value <= q['correctScore'], 'Marks are outside the question range.')
                a['manualMarks'][q['id']] = value
            a['shortlisted'] = False
            return jsonify(grade=grade(test['questions'], a))

    @app.get('/api/admin/tests/<test_id>/excel')
    @admin
    def export_excel(test_id):
        with store.transaction() as tx:
            test = test_required(tx, test_id)
            require(test['type'] != 'prompt', 'Use the Word document export for Prompt Engineering.')
            tx.expire(test_id)
            rows = results_rows(test, tx.all_attempts(test_id), *filter_numbers(request.args))
            require(rows, 'No candidates match the filters.')
            drive = next(d for d in tx.state['drives'] if d['id'] == test['driveId'])
            payload = excel(drive, test, rows)
            name = filename(drive['name'] + '_' + test['type'] + '_results') + '.xlsx'
        return send_file(io.BytesIO(payload), as_attachment=True, download_name=name,
                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    @app.get('/api/admin/tests/<test_id>/word')
    @admin
    def export_word(test_id):
        with store.transaction() as tx:
            test = test_required(tx, test_id)
            tx.expire(test_id)
            require(test['type'] == 'prompt' and test.get('closedAt'), 'Finish or stop the prompt test before exporting.')
            candidates = tx.all_attempts(test_id)
            require(candidates and all(a.get('submittedAt') for a in candidates), 'Responses are not complete.')
            drive = next(d for d in tx.state['drives'] if d['id'] == test['driveId'])
            payload = words(drive, test, candidates)
            name = filename(test['name'] + '_responses') + '.zip'
        return send_file(io.BytesIO(payload), as_attachment=True, download_name=name, mimetype='application/zip')

    if ready() and not local:
        def expiry_worker():
            while True:
                try:
                    with store.transaction() as tx:
                        tx.expire()
                except Exception as error:
                    app.logger.error('Expiry worker could not reach storage: %s', type(error).__name__)
                time.sleep(5)
        threading.Thread(target=expiry_worker, name='assessment-expiry', daemon=True).start()
    return app


application = create_app()

