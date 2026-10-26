"""Run interactively on your own device; enter the password without echoing it."""
import getpass
import secrets
from werkzeug.security import generate_password_hash

if __name__ == '__main__':
    password = getpass.getpass('Choose administrator password (at least 14 characters): ')
    if len(password) < 14:
        raise SystemExit('Use at least 14 characters.')
    if password != getpass.getpass('Repeat password: '):
        raise SystemExit('Passwords did not match.')
    print('Store these values as Azure Container Apps secrets, not repository files:')
    print('ADMIN_PASSWORD_HASH=' + generate_password_hash(password))
    print('SESSION_SECRET=' + secrets.token_urlsafe(48))
