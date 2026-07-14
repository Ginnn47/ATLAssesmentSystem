from django.contrib.auth.models import User
from django.test import Client, TestCase

from atlBackend.models import Criterion, SchoolClass, Student, Subject, Topic, UserProfile


class ReportsBlackboxTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_superuser(username="admin_test", password="Admin12345")
        UserProfile.objects.create(user=self.user, role_label="Admin", role_group="Admin", status="Aktif")
        self.client.login(username="admin_test", password="Admin12345")
        self.school_class = SchoolClass.objects.create(code="1A", display_name="1A - Primary", level="Primary")
        self.student = Student.objects.create(nis="NIS001", full_name="Student A", school_class=self.school_class)
        self.subject = Subject.objects.create(code="singing", label="Singing")
        self.topic = Topic.objects.create(subject=self.subject, code="singing_report_test", label="Report Test")
        Criterion.objects.create(
            topic=self.topic,
            name="Participation",
            atl=["Communication Skills"],
            levels={"NFI": "Low", "PTE": "Basic", "DE": "Developing", "ME": "Good", "EE": "Excellent"},
        )

    def test_report_returns_no_data_rows_for_unassessed_student(self):
        response = self.client.get("/api/reports/", {"class": "1A - Primary", "topic": self.topic.code})
        self.assertEqual(response.status_code, 200)
        students = response.json().get("students", [])
        self.assertEqual(len(students), 1)
        self.assertEqual(students[0]["name"], "Student A")
        self.assertEqual(students[0]["predikat"], "No Data")

    def test_report_export_requires_rows(self):
        response = self.client.post(
            "/api/reports/export/",
            data={"meta": {"filename": "blackbox.xlsx"}, "columns": [], "rows": []},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

