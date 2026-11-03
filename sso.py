"""Microsoft work-account sign-in and database-backed Talent Hub membership."""
import re
import secrets
from flask import jsonify, redirect, request, session
from authlib.integrations.flask_client import OAuth

INITIAL_ADMINS = [
    'mohamed.shareef@turnb.com', 'ajin.das@turnb.com', 'amrita.sunilkumar@turnb.com',
    'gopu.shaji@turnb.com', 'vysakh.k@turnb.com', 'nandana.nair@turnb.com',
    'mahesh.pillai@turnb.com', 'aruna.niyas@turnb.com', 'ancy.sam@turnb.com']
DENIED = 'You are not added as a user into Talent Hub. Please reach out to HR and ask them to add you as a user, then try logging in again.'


def install_sso(app, store, admin, require):
    enabled = app.config['AUTH_MODE'] == 'sso'
    tenant = app.config['ENTRA_TENANT_ID']
    oauth = OAuth(app)
    if enabled and re.fullmatch(r'[0-9a-fA-F-]{36}', tenant):
        oauth.register('microsoft', client_id=app.config['ENTRA_CLIENT_ID'],
            client_secret=app.config['ENTRA_CLIENT_SECRET'],
            server_metadata_url=f'https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration',
            client_kwargs={'scope': 'openid profile email', 'code_challenge_method': 'S256', 'timeout': 20})
    app.extensions['talent_oauth'] = oauth

    def users(tx):
        # Seed exactly once. An intentionally empty/modified list is never reseeded.
        return tx.state.setdefault('adminUsers', {email: {'email': email, 'oid': None} for email in INITIAL_ADMINS})

    def active():
        if not enabled:
            return bool(session.get('admin'))
        email, oid = session.get('admin_email'), session.get('admin_oid')
        if not email or not oid or session.get('admin_tenant') != tenant:
            return False
        with store.transaction() as tx:
            member = users(tx).get(email)
            return bool(member and member.get('oid') == oid)
    app.extensions['admin_active'] = active

    @app.get('/auth/microsoft')
    def microsoft_login():
        require(enabled and bool(app.config['ENTRA_CLIENT_ID']) and bool(app.config['ENTRA_CLIENT_SECRET']), 'Microsoft sign-in is not configured yet.')
        return oauth.microsoft.authorize_redirect(app.config['PUBLIC_ORIGIN'].rstrip('/')+'/auth/callback', prompt='select_account')

    @app.get('/auth/callback')
    def microsoft_callback():
        if not enabled:
            return redirect('/')
        try:
            token = oauth.microsoft.authorize_access_token()
            claims = token.get('userinfo') or {}
            # Authlib verifies signature, issuer, audience, state, expiry and nonce.
            require(claims.get('tid') == tenant and bool(claims.get('oid')), 'Use your TurnB work account.')
            email = str(claims.get('preferred_username') or claims.get('email') or '').strip().casefold()
            require(email.endswith('@turnb.com'), 'Use your TurnB work account.')
            with store.transaction() as tx:
                member = users(tx).get(email)
                if not member or member.get('oid') not in (None, claims['oid']):
                    session.clear(); session['sso_error'] = DENIED
                    return redirect('/')
                member['oid'] = claims['oid']
            session.clear()
            session.update(admin=True, admin_email=email, admin_oid=claims['oid'], admin_tenant=tenant, csrf=secrets.token_urlsafe(32))
            session.permanent = True
        except Exception:
            app.logger.warning('Microsoft sign-in failed')
            session.clear(); session['sso_error'] = 'Microsoft sign-in could not be completed. Please try again with your TurnB work account.'
        return redirect('/')

    @app.get('/api/admin/users')
    @admin
    def list_users():
        with store.transaction() as tx:
            return jsonify(users=sorted(users(tx)), currentEmail=session.get('admin_email', ''))

    @app.post('/api/admin/users')
    @admin
    def manage_users():
        data = request.get_json()
        require(isinstance(data, dict), 'Invalid user request.')
        email = str(data.get('email', '')).strip().casefold()
        require(bool(re.fullmatch(r'[a-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@turnb\.com', email)) and len(email)<=200, 'Enter a valid TurnB work email address.')
        require(data.get('action') in {'add', 'delete'}, 'Choose Add user or Delete user.')
        with store.transaction() as tx:
            members = users(tx)
            if data['action'] == 'add':
                members.setdefault(email, {'email': email, 'oid': None})
            else:
                require(email != session.get('admin_email'), 'You cannot delete your own access while signed in.')
                require(len(members)>1, 'At least one administrator must remain.')
                members.pop(email, None)
            return jsonify(users=sorted(members))

