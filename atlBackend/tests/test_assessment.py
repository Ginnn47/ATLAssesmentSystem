from django.contrib.auth.models import User
from django.test import Client, TestCase

from atlBackend.models import Criterion, Subject, Topic, UserProfile


class AssessmentBlackboxTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_superuser(username="admin_test", password="Admin12345")
        UserProfile.objects.create(user=self.user, role_label="Admin", role_group="Admin", status="Aktif")
        self.client.login(username="admin_test", password="Admin12345")
        self.subject = Subject.objects.create(code="singing", label="Singing")
        self.topic = Topic.objects.create(subject=self.subject, code="singing_test", label="Singing Test")
        self.criterion = Criterion.objects.create(
            topic=self.topic,
            name="Role Play",
            atl=["Communication Skills"],
            levels={"NFI": "Low", "PTE": "Basic", "DE": "Developing", "ME": "Good", "EE": "Excellent"},
        )

    def test_save_assessment_success(self):
        rating_key = f"{self.topic.code}_{self.criterion.name}_Communication Skills"
        response = self.client.post(
            "/api/assessments/",
            data={
                "studentId": "student-1",
                "topic": self.topic.code,
                "ratings": {rating_key: "Meeting Expectation"},
                "teacherNote": "Blackbox note",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "saved")

    def test_save_assessment_rejects_empty_ratings(self):
        response = self.client.post(
            "/api/assessments/",
            data={"studentId": "student-1", "topic": self.topic.code, "ratings": {}},
            content_type="application/json",
        )
        self.assertIn(response.status_code, [400, 422])

