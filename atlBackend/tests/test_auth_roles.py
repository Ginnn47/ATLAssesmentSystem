from django.contrib.auth.models import User
from django.test import Client, TestCase

from atlBackend.models import UserProfile


class AuthRoleBlackboxTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_superuser(
            username="admin_test",
            email="admin@test.com",
            password="Admin12345",
        )
        UserProfile.objects.create(
            user=self.admin,
            role_label="Admin",
            role_group="Admin",
            status="Aktif",
        )
        self.guru = User.objects.create_user(
            username="guru_test",
            email="guru@test.com",
            password="Guru12345",
        )
        UserProfile.objects.create(
            user=self.guru,
            role_label="Guru Wali Kelas",
            role_group="Guru Wali Kelas",
            status="Aktif",
        )

    def test_login_success(self):
        response = self.client.post(
            "/api/auth/login/",
            data={"username": "admin_test", "password": "Admin12345"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "admin_test")

    def test_login_failed_wrong_password(self):
        response = self.client.post(
            "/api/auth/login/",
            data={"username": "admin_test", "password": "password_salah"},
            content_type="application/json",
        )
        self.assertIn(response.status_code, [400, 401, 403])

    def test_access_users_without_login_should_fail(self):
        response = self.client.get("/api/users/")
        self.assertIn(response.status_code, [401, 403])

    def test_non_admin_cannot_access_users_api(self):
        self.client.login(username="guru_test", password="Guru12345")
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, 403)

