import os
import sys
from pathlib import Path


smoke_db = Path('smoke_reset.db')
if smoke_db.exists():
    smoke_db.unlink()

os.environ['DATABASE_URL'] = f"sqlite:///{smoke_db.as_posix()}"
os.environ['SECRET_KEY'] = 'smoke-reset-secret'
os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'] = '60'
os.environ['REFRESH_TOKEN_EXPIRE_DAYS'] = '30'
os.environ['RATE_LIMIT_LOGIN_PER_MINUTE'] = '100'
os.environ['RATE_LIMIT_PASSWORD_RESET_PER_MINUTE'] = '100'

from fastapi.testclient import TestClient
from app.api.deps import engine
from app.api.v1 import users as users_api
from app.core.models import Base
from app.main import app


Base.metadata.create_all(bind=engine)
client = TestClient(app)

captured_reset_email = {}
results = []


def check(name, condition, detail=''):
    results.append((name, bool(condition), detail))


def fake_send_email(to_email, subject, body, reset_url, reset_code, username):
    captured_reset_email.clear()
    captured_reset_email.update({
        'to_email': to_email,
        'subject': subject,
        'body': body,
        'reset_url': reset_url,
        'reset_code': reset_code,
        'username': username,
    })
    return True


users_api.send_email = fake_send_email

username = 'smoke_reset'
original_password = 'SmokeReset123!'
updated_password = 'ResetSmoke456!'
email = 'smoke_reset@example.com'

signup_payload = {
    'first_name': 'Smoke',
    'last_name': 'Reset',
    'username': username,
    'email': email,
    'password': original_password,
}

r = client.post('/api/v1/users/signup', json=signup_payload)
check('signup returns 200', r.status_code == 200, f'status={r.status_code}')

captured_reset_email.clear()
r = client.post('/api/v1/users/request-password-reset', json={'email': 'unknown_reset@example.com'})
unknown_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
check('unknown reset request returns 200', r.status_code == 200, f'status={r.status_code}')
check(
    'unknown reset request returns generic message',
    unknown_data.get('message') == 'If that email is registered, a reset link has been sent',
    str(unknown_data),
)
check('unknown reset request sends no email', captured_reset_email == {}, str(captured_reset_email))

r = client.post('/api/v1/users/request-password-reset', json={'email': email})
request_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
reset_code = captured_reset_email.get('reset_code')
check('known reset request returns 200', r.status_code == 200, f'status={r.status_code}')
check(
    'known reset request returns generic message',
    request_data.get('message') == 'If that email is registered, a reset link has been sent',
    str(request_data),
)
check('reset email captured', captured_reset_email.get('to_email') == email, str(captured_reset_email))
check('reset code captured', isinstance(reset_code, str) and len(reset_code) > 20, str(reset_code))
check(
    'reset url captured',
    isinstance(captured_reset_email.get('reset_url'), str) and 'reset-password/reset' in captured_reset_email.get('reset_url', ''),
    str(captured_reset_email.get('reset_url')),
)

if reset_code:
    r = client.post('/api/v1/users/verify-reset-code', json={'email': email, 'code': reset_code})
    check('verify-reset-code returns 200', r.status_code == 200, f'status={r.status_code}')

    r = client.post('/api/v1/users/verify-reset-code', json={'email': 'wrong@example.com', 'code': reset_code})
    check('verify-reset-code rejects mismatched email', r.status_code == 400, f'status={r.status_code}')

    r = client.post('/api/v1/users/reset-password', json={'email': email, 'code': reset_code, 'new_password': updated_password})
    check('reset-password returns 200', r.status_code == 200, f'status={r.status_code}')

    r = client.post('/api/v1/users/login-json', json={'username': username, 'password': original_password, 'grant_type': 'password'})
    check('old password rejected after reset', r.status_code == 401, f'status={r.status_code}')

    r = client.post('/api/v1/users/login-json', json={'username': username, 'password': updated_password, 'grant_type': 'password'})
    login_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
    check('new password accepted after reset', r.status_code == 200, f'status={r.status_code}')
    check(
        'new password login returns access token',
        isinstance(login_data.get('access_token'), str) and len(login_data.get('access_token', '')) > 20,
        str(login_data),
    )
else:
    check('verify-reset-code returns 200', False, 'missing reset code')
    check('verify-reset-code rejects mismatched email', False, 'missing reset code')
    check('reset-password returns 200', False, 'missing reset code')
    check('old password rejected after reset', False, 'missing reset code')
    check('new password accepted after reset', False, 'missing reset code')
    check('new password login returns access token', False, 'missing reset code')

print('SMOKE_RESET_RESULTS_START')
passed = 0
for name, ok, detail in results:
    status = 'PASS' if ok else 'FAIL'
    if ok:
        passed += 1
    print(f'[{status}] {name} {detail}')
failed = len(results) - passed
print(f'SUMMARY: {passed}/{len(results)} passed')
print('SMOKE_RESET_RESULTS_END')

client.close()

if smoke_db.exists():
    try:
        smoke_db.unlink()
    except PermissionError:
        pass

if failed > 0:
    sys.exit(1)