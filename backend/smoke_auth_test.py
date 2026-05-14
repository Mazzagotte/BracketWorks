import os
import sys
from pathlib import Path

smoke_db = Path('smoke_auth.db')
if smoke_db.exists():
    smoke_db.unlink()

os.environ['DATABASE_URL'] = f"sqlite:///{smoke_db.as_posix()}"
os.environ['SECRET_KEY'] = 'smoke-test-secret'
os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'] = '60'
os.environ['REFRESH_TOKEN_EXPIRE_DAYS'] = '30'
os.environ['RATE_LIMIT_LOGIN_PER_MINUTE'] = '100'
os.environ['RATE_LIMIT_PASSWORD_RESET_PER_MINUTE'] = '100'

from fastapi.testclient import TestClient
from app.core.models import Base, User
from app.api.deps import engine, SessionLocal
from app.api.v1 import users as users_api
from app.main import app

Base.metadata.create_all(bind=engine)
client = TestClient(app)

captured_reset_email = {}


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

username = 'smoke_user'
password = 'SmokePass123!'
email = 'smoke_user@example.com'
reset_username = 'smoke_reset'
reset_password = 'SmokeReset123!'
reset_email = 'smoke_reset@example.com'

results = []

def check(name, condition, detail=''):
    results.append((name, bool(condition), detail))

signup_payload = {
    'first_name': 'Smoke',
    'last_name': 'Tester',
    'username': username,
    'email': email,
    'password': password,
}
r = client.post('/api/v1/users/signup', json=signup_payload)
check('signup returns 200', r.status_code == 200, f'status={r.status_code}')

r = client.post('/api/v1/users/login-json', json={'username': username, 'password': password, 'grant_type': 'password'})
login_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
check('login-json returns 200', r.status_code == 200, f'status={r.status_code}')
check('login-json has access_token', isinstance(login_data.get('access_token'), str) and len(login_data.get('access_token', '')) > 20)
check('login-json has refresh_token', isinstance(login_data.get('refresh_token'), str) and len(login_data.get('refresh_token', '')) > 20)
check('login-json has session_id', isinstance(login_data.get('session_id'), str) and len(login_data.get('session_id', '')) > 5)

access_token = login_data.get('access_token')
refresh_token = login_data.get('refresh_token')
headers = {'Authorization': f'Bearer {access_token}'}

r = client.get('/api/v1/users/me', headers=headers)
check('/me returns 200 with bearer', r.status_code == 200, f'status={r.status_code}')

r = client.post('/api/v1/users/refresh', json={'refresh_token': refresh_token})
refresh_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
check('/refresh returns 200', r.status_code == 200, f'status={r.status_code}')
check('/refresh returns new refresh token', refresh_data.get('refresh_token') != refresh_token)

new_access = refresh_data.get('access_token')
new_refresh = refresh_data.get('refresh_token')
new_headers = {'Authorization': f'Bearer {new_access}'}

r = client.post('/api/v1/users/logout', headers=new_headers, json={'refresh_token': new_refresh, 'all_sessions': False})
logout_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
check('/logout returns 200', r.status_code == 200, f'status={r.status_code}')
check('/logout revoked >=1 sessions', int(logout_data.get('revoked_sessions', 0)) >= 1, str(logout_data))

r = client.post('/api/v1/users/refresh', json={'refresh_token': new_refresh})
check('/refresh with revoked token returns 401', r.status_code == 401, f'status={r.status_code}')

reset_signup_payload = {
    'first_name': 'Smoke',
    'last_name': 'Reset',
    'username': reset_username,
    'email': reset_email,
    'password': reset_password,
}
r = client.post('/api/v1/users/signup', json=reset_signup_payload)
check('reset user signup returns 200', r.status_code == 200, f'status={r.status_code}')

captured_reset_email.clear()
r = client.post('/api/v1/users/request-password-reset', json={'email': 'unknown_reset@example.com'})
request_unknown_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
check('request-password-reset unknown email returns 200', r.status_code == 200, f'status={r.status_code}')
check(
    'request-password-reset unknown email returns generic message',
    request_unknown_data.get('message') == 'If that email is registered, a reset link has been sent',
    str(request_unknown_data),
)
check('request-password-reset unknown email sends no email', captured_reset_email == {}, str(captured_reset_email))

r = client.post('/api/v1/users/request-password-reset', json={'email': reset_email})
request_reset_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
reset_code = captured_reset_email.get('reset_code')
check('request-password-reset known email returns 200', r.status_code == 200, f'status={r.status_code}')
check(
    'request-password-reset known email returns generic message',
    request_reset_data.get('message') == 'If that email is registered, a reset link has been sent',
    str(request_reset_data),
)
check('request-password-reset captures reset email', captured_reset_email.get('to_email') == reset_email, str(captured_reset_email))
check('request-password-reset captures reset code', isinstance(reset_code, str) and len(reset_code) > 20, str(reset_code))
check(
    'request-password-reset captures reset url',
    isinstance(captured_reset_email.get('reset_url'), str) and 'reset-password/reset' in captured_reset_email.get('reset_url', ''),
    str(captured_reset_email.get('reset_url')),
)

if reset_code:
    r = client.post('/api/v1/users/verify-reset-code', json={'email': reset_email, 'code': reset_code})
    check('verify-reset-code returns 200', r.status_code == 200, f'status={r.status_code}')

    r = client.post('/api/v1/users/verify-reset-code', json={'email': 'wrong@example.com', 'code': reset_code})
    check('verify-reset-code rejects mismatched email', r.status_code == 400, f'status={r.status_code}')

    updated_reset_password = 'ResetSmoke456!'
    r = client.post('/api/v1/users/reset-password', json={'email': reset_email, 'code': reset_code, 'new_password': updated_reset_password})
    check('reset-password returns 200', r.status_code == 200, f'status={r.status_code}')

    r = client.post('/api/v1/users/login-json', json={'username': reset_username, 'password': reset_password, 'grant_type': 'password'})
    check('login-json rejects old password after reset', r.status_code == 401, f'status={r.status_code}')

    r = client.post('/api/v1/users/login-json', json={'username': reset_username, 'password': updated_reset_password, 'grant_type': 'password'})
    reset_login_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
    check('login-json accepts new password after reset', r.status_code == 200, f'status={r.status_code}')
    check(
        'login-json after reset returns access token',
        isinstance(reset_login_data.get('access_token'), str) and len(reset_login_data.get('access_token', '')) > 20,
        str(reset_login_data),
    )
else:
    check('verify-reset-code returns 200', False, 'missing reset code')
    check('verify-reset-code rejects mismatched email', False, 'missing reset code')
    check('reset-password returns 200', False, 'missing reset code')
    check('login-json rejects old password after reset', False, 'missing reset code')
    check('login-json accepts new password after reset', False, 'missing reset code')
    check('login-json after reset returns access token', False, 'missing reset code')

bad_statuses = []
for _ in range(6):
    rb = client.post('/api/v1/users/login-json', json={'username': username, 'password': 'wrong-pass', 'grant_type': 'password'})
    bad_statuses.append(rb.status_code)
check('bad-login sequence includes 429 block', 429 in bad_statuses, str(bad_statuses))

target_username = 'smoke_target'
target_password = 'SmokeTarget123!'
target_email = 'smoke_target@example.com'

target_signup_payload = {
    'first_name': 'Smoke',
    'last_name': 'Target',
    'username': target_username,
    'email': target_email,
    'password': target_password,
}
r = client.post('/api/v1/users/signup', json=target_signup_payload)
check('target signup returns 200', r.status_code == 200, f'status={r.status_code}')

r = client.post('/api/v1/users/login-json', json={'username': target_username, 'password': target_password, 'grant_type': 'password'})
active_data = r.json() if r.status_code == 200 else {}
active_refresh = active_data.get('refresh_token')
target_user_id = active_data.get('user_id')

admin_username = 'smoke_admin'
admin_password = 'SmokeAdmin123!'
admin_email = 'smoke_admin@example.com'

admin_signup_payload = {
    'first_name': 'Smoke',
    'last_name': 'Admin',
    'username': admin_username,
    'email': admin_email,
    'password': admin_password,
}
r = client.post('/api/v1/users/signup', json=admin_signup_payload)
check('admin signup returns 200', r.status_code == 200, f'status={r.status_code}')

with SessionLocal() as db:
    admin_user = db.query(User).filter(User.username == admin_username).first()
    if admin_user:
        admin_user.is_admin = True
        db.commit()

r = client.post('/api/v1/users/login-json', json={'username': admin_username, 'password': admin_password, 'grant_type': 'password'})
admin_data = r.json() if r.status_code == 200 else {}
admin_headers = {'Authorization': f"Bearer {admin_data.get('access_token', '')}"}

if target_user_id:
    r = client.post(f'/api/v1/users/admin/revoke-user-sessions/{target_user_id}', headers=admin_headers)
    revoke_data = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
    check('/admin/revoke-user-sessions returns 200', r.status_code == 200, f'status={r.status_code}')
    check('/admin/revoke-user-sessions revoked >=1 sessions', int(revoke_data.get('revoked_sessions', 0)) >= 1, str(revoke_data))
else:
    check('/admin/revoke-user-sessions returns 200', False, 'target user login failed')
    check('/admin/revoke-user-sessions revoked >=1 sessions', False, 'target user login failed')

if active_refresh:
    r = client.post('/api/v1/users/refresh', json={'refresh_token': active_refresh})
    check('revoked user refresh returns 401', r.status_code == 401, f'status={r.status_code}')

print('SMOKE_TEST_RESULTS_START')
passed = 0
for name, ok, detail in results:
    status = 'PASS' if ok else 'FAIL'
    if ok:
        passed += 1
    print(f'[{status}] {name} {detail}')
failed = len(results) - passed
print(f'SUMMARY: {passed}/{len(results)} passed')
print('SMOKE_TEST_RESULTS_END')

client.close()

if smoke_db.exists():
    try:
        smoke_db.unlink()
    except PermissionError:
        pass

if failed > 0:
    sys.exit(1)
