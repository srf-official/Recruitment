import copy
import io
import json
import tempfile
import time
import unittest
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from docx import Document
from openpyxl import load_workbook
from werkzeug.security import generate_password_hash

from app import create_app
from domain import grade


def uid():
    return str(uuid.uuid4())


def question(kind='single', key=None):
    return {'id': 'q1', 'type': kind, 'text': 'Synthetic test question',
            'options': ['One', 'Two'] if kind != 'text' else [],
            'key': [1] if key is None and kind != 'text' else (key or []),
            'correctScore': 2, 'wrongScore': -1,
            'referenceAnswer': 'PRIVATE REFERENCE', 'reviewNote': 'PRIVATE REVIEW'}


class ApplicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = generate_password_hash('Test-only-password-123')

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.url = 'sqlite:///' + str(Path(self.directory.name, 'test.db')).replace('\\', '/')
        self.settings = {'TESTING': True, 'APP_ENV': 'test', 'DATABASE_URL': self.url,
                         'SECRET_KEY': 'test-secret-not-production', 'ADMIN_PASSWORD_HASH': self.password_hash}
        self.app = create_app(self.settings)
        self.admin = self.app.test_client()
        csrf = self.admin.get('/api/auth/session').json['csrf']
        result = self.admin.post('/api/auth/login', json={'email': 'turnbrecruitment@gmail.com', 'password': 'Test-only-password-123'}, headers={'X-CSRF-Token': csrf})
        self.csrf = result.json['csrf']
        self.drive = uid()
        self.tests = {kind: uid() for kind in ('aptitude', 'language', 'prompt')}
        state = {'drives': [{'id': self.drive, 'name': 'Synthetic college 2026', 'finishedAt': None}],
                 'questionSets': {'aptitude': [question()], 'language': [question('text')], 'prompt': [question('text')]},
                 'sessions': [{'id': tid, 'driveId': self.drive, 'type': kind, 'questions': [question('text' if kind != 'aptitude' else 'single')], 'closedAt': None}
                              for kind, tid in self.tests.items()]}
        response = self.put_state(state, 0)
        self.assertEqual(response.status_code, 200, response.json)

    def tearDown(self):
        self.app.extensions['store'].engine.dispose()
        self.directory.cleanup()

    def put_state(self, state, revision):
        return self.admin.put('/api/admin/state', json={'state': state, 'revision': revision}, headers={'X-CSRF-Token': self.csrf})

    def candidate(self, kind='aptitude', name='Test Candidate', student='ID001'):
        client = self.app.test_client()
        csrf = client.get('/api/auth/session').json['csrf']
        tid = self.tests[kind]
        response = client.post(f'/api/candidate/{tid}/start', json={'name': name, 'studentId': student}, headers={'X-CSRF-Token': csrf})
        self.assertEqual(response.status_code, 200, response.json)
        return client, csrf, response.json['test']['attempts'][0]

    def answer(self, client, csrf, kind='aptitude', responses=None, sequence=1, submit=False):
        return client.post(f'/api/candidate/{self.tests[kind]}/answer', json={'responses': responses if responses is not None else {'q1': [1]}, 'sequence': sequence, 'submit': submit}, headers={'X-CSRF-Token': csrf})

    def state(self):
        return self.admin.get('/api/admin/state').json

    def test_security_and_no_question_leakage(self):
        guest = self.app.test_client()
        self.assertEqual(guest.get('/api/admin/state').status_code, 401)
        self.assertEqual(guest.get(f'/api/admin/tests/{self.tests["aptitude"]}/excel').status_code, 401)
        self.assertEqual(guest.post('/api/auth/logout', json={}).status_code, 403)
        public = guest.get('/api/candidate/' + self.tests['aptitude']).json
        self.assertEqual(public['test']['questions'], [])
        client, _, _ = self.candidate()
        public = client.get('/api/candidate/' + self.tests['aptitude']).json
        serialized = json.dumps(public)
        self.assertNotIn('PRIVATE REFERENCE', serialized)
        self.assertNotIn('PRIVATE REVIEW', serialized)
        self.assertNotIn('"key"', serialized)
        self.assertNotIn('token_hash', serialized)
        self.assertEqual(guest.get('/healthz').headers['X-Frame-Options'], 'DENY')

    def test_individual_durations_and_duplicate_student(self):
        for kind, minutes in [('aptitude', 15), ('language', 20), ('prompt', 30)]:
            _, _, a = self.candidate(kind)
            self.assertEqual(a['deadline'] - a['startedAt'], minutes * 60000)
        other = self.app.test_client()
        csrf = other.get('/api/auth/session').json['csrf']
        response = other.post('/api/candidate/' + self.tests['aptitude'] + '/start', json={'name': 'Other', 'studentId': 'id001'}, headers={'X-CSRF-Token': csrf})
        self.assertEqual(response.status_code, 400)

    def test_submission_idempotency_and_save_sequence(self):
        c, csrf, _ = self.candidate()
        self.assertEqual(self.answer(c, csrf, sequence=2).status_code, 200)
        a = self.answer(c, csrf, responses={'q1': [0]}, sequence=1).json['test']['attempts'][0]
        self.assertEqual(a['responses']['q1'], [1])
        result = self.answer(c, csrf, sequence=3, submit=True)
        original = result.json['test']['attempts'][0]
        later = self.answer(c, csrf, responses={'q1': [0]}, sequence=4, submit=True).json['test']['attempts'][0]
        self.assertEqual(original['submittedAt'], later['submittedAt'])
        self.assertEqual(later['responses']['q1'], [1])

    def test_matching_key_is_not_exposed_and_choices_are_attempt_bound(self):
        state = self.state()
        test = next(s for s in state['state']['sessions'] if s['type'] == 'aptitude')
        test['questions'] = [{'id': 'match1', 'type': 'matching', 'text': 'Match synthetic items',
                             'pairs': [{'left': 'A', 'right': 'a'}, {'left': 'B', 'right': 'b'}],
                             'correctScore': 2, 'wrongScore': 0}]
        self.assertEqual(self.put_state(state['state'], state['revision']).status_code, 200)
        client, csrf, _ = self.candidate()
        public = client.get('/api/candidate/' + self.tests['aptitude']).json['test']['questions'][0]
        self.assertNotIn('pairs', public)
        self.assertEqual(public['leftItems'], ['A', 'B'])
        tokens = {p['label']: p['id'] for p in public['rightChoices']}
        result = self.answer(client, csrf, responses={'match1': [tokens['a'], tokens['b']]}, submit=True)
        self.assertEqual(result.status_code, 200, result.json)
        with self.app.extensions['store'].transaction() as tx:
            a = tx.all_attempts(self.tests['aptitude'])[0]
            self.assertEqual(grade(tx.test(self.tests['aptitude'])['questions'], a)['total'], 2)

    def test_timeout_rejects_late_payload_and_resume_survives_restart(self):
        c, csrf, a = self.candidate()
        self.answer(c, csrf)
        with self.app.extensions['store'].transaction() as tx:
            tx.all_attempts(self.tests['aptitude'])[0]['deadline'] = int(time.time() * 1000) - 100
        result = self.answer(c, csrf, responses={'q1': [0]}, sequence=3, submit=True)
        locked = result.json['test']['attempts'][0]
        self.assertEqual(locked['reason'], 'timeout')
        self.assertEqual(locked['responses']['q1'], [1])
        restarted = create_app(self.settings)
        with restarted.extensions['store'].transaction() as tx:
            self.assertEqual(tx.all_attempts(self.tests['aptitude'])[0]['responses']['q1'], [1])
        restarted.extensions['store'].engine.dispose()

    def test_admin_stop_saves_blank_and_partial_answers(self):
        c, csrf, _ = self.candidate(student='PARTIAL')
        self.answer(c, csrf)
        self.candidate(student='BLANK')
        state = self.state()
        next(s for s in state['state']['sessions'] if s['type'] == 'aptitude')['closedAt'] = 1
        result = self.put_state(state['state'], state['revision'])
        self.assertEqual(result.status_code, 200, result.json)
        test = next(s for s in result.json['state']['sessions'] if s['type'] == 'aptitude')
        self.assertTrue(all(a['reason'] == 'admin' for a in test['attempts']))
        self.assertEqual(len(test['attempts'][1]['responses']), 0)
        self.assertEqual(c.get('/api/candidate/' + self.tests['aptitude']).json['test']['attempts'][0]['reason'], 'admin')

    def test_question_lock_and_admin_revision_conflict(self):
        state = self.state()
        self.candidate()
        next(s for s in state['state']['sessions'] if s['type'] == 'aptitude')['questions'][0]['text'] = 'Changed after start'
        self.assertEqual(self.put_state(state['state'], state['revision']).status_code, 400)
        state = self.state()
        state['state']['drives'][0]['name'] = 'Renamed'
        self.assertEqual(self.put_state(state['state'], state['revision']).status_code, 200)
        self.assertEqual(self.put_state(state['state'], state['revision']).status_code, 409)

    def test_marks_filters_bulk_shortlist_and_excel(self):
        c, csrf, a = self.candidate(name='=HYPERLINK("https://invalid")', student='00001')
        self.answer(c, csrf, submit=True)
        result = self.admin.post(f'/api/admin/tests/{self.tests["aptitude"]}/shortlist', json={'minMarks': 2, 'minTime': 0}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(result.json['changed'], 1)
        exported = self.admin.get(f'/api/admin/tests/{self.tests["aptitude"]}/excel?minMarks=2&minTime=0')
        book = load_workbook(io.BytesIO(exported.data))
        self.assertEqual(book.active.cell(2, 3).value, '00001')
        self.assertEqual(book.active.cell(2, 4).value, 2)
        self.assertEqual(book.active.cell(2, 2).data_type, 's')
        self.assertEqual(book.active.cell(2, 7).value, 'Yes')
        reverted = self.admin.post(f'/api/admin/tests/{self.tests["aptitude"]}/shortlist', json={'value': False}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(reverted.json['changed'], 1)
        cleared = load_workbook(io.BytesIO(self.admin.get(f'/api/admin/tests/{self.tests["aptitude"]}/excel').data))
        self.assertEqual(cleared.active.cell(2, 7).value, 'No')
        self.assertEqual(self.admin.get(f'/api/admin/tests/{self.tests["aptitude"]}/excel?minTime=-1').status_code, 400)

    def test_manual_review_blocks_shortlist_then_unlocks(self):
        c, csrf, a = self.candidate('language')
        self.answer(c, csrf, 'language', responses={'q1': 'Essay'}, submit=True)
        url = f'/api/admin/tests/{self.tests["language"]}'
        response = self.admin.post(url + '/shortlist', json={}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(response.json['skipped'], 1)
        marked = self.admin.post(url + '/marks', json={'attemptId': a['id'], 'questionId': 'q1', 'score': 1.5}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(marked.json['grade']['total'], 1.5)
        response = self.admin.post(url + '/shortlist', json={}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(response.json['changed'], 1)

    def test_prompt_closes_only_after_all_started_candidates_submit_and_exports(self):
        first, csrf1, a = self.candidate('prompt', name='First Candidate', student='P1')
        second, csrf2, _ = self.candidate('prompt', name='Second Candidate', student='P2')
        url = f'/api/admin/tests/{self.tests["prompt"]}/word'
        self.assertEqual(self.admin.get(url).status_code, 400)
        self.answer(first, csrf1, 'prompt', {'q1': 'Long response\nwith <markup> & symbols'}, submit=True)
        self.assertEqual(self.admin.get(url).status_code, 400)
        self.answer(second, csrf2, 'prompt', {'q1': ''}, submit=True)
        response = self.admin.get(url)
        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
            self.assertEqual(set(archive.namelist()), {'First Candidate_P1.docx', 'Second Candidate_P2.docx'})
            doc = Document(io.BytesIO(archive.read('First Candidate_P1.docx')))
            self.assertIn('with <markup> & symbols', '\n'.join(p.text for p in doc.paragraphs))
            doc = Document(io.BytesIO(archive.read('Second Candidate_P2.docx')))
            self.assertIn('(No answer entered)', '\n'.join(p.text for p in doc.paragraphs))

    def test_fifty_concurrent_starts_saves_and_submissions(self):
        def worker(number):
            client = self.app.test_client()
            csrf = client.get('/api/auth/session').json['csrf']
            headers = {'X-CSRF-Token': csrf}
            start = client.post(f'/api/candidate/{self.tests["aptitude"]}/start', json={'name': f'Synthetic {number}', 'studentId': f'LOAD{number:03}'}, headers=headers)
            if start.status_code != 200:
                return start.status_code
            saved = self.answer(client, csrf, sequence=1)
            submitted = self.answer(client, csrf, sequence=2, submit=True)
            return submitted.status_code if saved.status_code == 200 else saved.status_code
        begin = time.monotonic()
        with ThreadPoolExecutor(max_workers=50) as pool:
            results = list(pool.map(worker, range(50)))
        self.assertEqual(results, [200] * 50)
        state = self.state()
        test = next(s for s in state['state']['sessions'] if s['type'] == 'aptitude')
        self.assertEqual(len(test['attempts']), 50)
        self.assertTrue(all(a['submittedAt'] for a in test['attempts']))
        print(f'50-client durable-store concurrency test completed in {time.monotonic()-begin:.2f}s')


if __name__ == '__main__':
    unittest.main()
