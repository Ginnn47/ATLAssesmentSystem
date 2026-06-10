from django.core.management.base import BaseCommand

from atlBackend.models import Topic
from atlBackend.services.contextual_atl import ensure_assessable_topic, ensure_contextual_seed


class Command(BaseCommand):
    help = "Repair ATL topic/context/rubric links so assessable topics can save assessments."

    def handle(self, *args, **options):
        ensure_contextual_seed()
        repaired = 0
        blocked = 0
        for topic in Topic.objects.filter(is_active=True).select_related("subject").order_by("subject__code", "order", "label"):
            status = ensure_assessable_topic(topic.code)
            rubric_count = status.get("rubricCount", 0)
            if status.get("contextAvailable"):
                repaired += 1
            if not status.get("isAssessable"):
                blocked += 1
            marker = "OK" if status.get("isAssessable") else "NO_RUBRIC"
            self.stdout.write(f"{marker}: {topic.code} rubricCount={rubric_count}")
        self.stdout.write(self.style.SUCCESS(f"Checked {repaired} topic contexts; {blocked} topics still need criteria."))
