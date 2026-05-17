from django.db import models


class Subject(models.Model):
    code = models.CharField(max_length=40, unique=True)
    label = models.CharField(max_length=120)

    def __str__(self):
        return self.label


class Topic(models.Model):
    subject = models.ForeignKey(Subject, related_name="topics", on_delete=models.CASCADE)
    code = models.CharField(max_length=80, unique=True)
    label = models.CharField(max_length=160)
    description = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["subject__code", "order", "label"]

    def __str__(self):
        return self.label


class Criterion(models.Model):
    topic = models.ForeignKey(Topic, related_name="criteria", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    atl = models.JSONField(default=list)
    levels = models.JSONField(default=dict)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["topic__code", "order", "id"]

    def __str__(self):
        return self.name


class FuzzyWeight(models.Model):
    topic = models.ForeignKey(Topic, related_name="weights", on_delete=models.CASCADE)
    weights = models.JSONField(default=dict)
    debug = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["topic"], name="unique_fuzzy_weight_per_topic")
        ]

    def __str__(self):
        return f"Weights for {self.topic.code}"


class Assessment(models.Model):
    student_id = models.CharField(max_length=80)
    topic = models.ForeignKey(Topic, related_name="assessments", on_delete=models.CASCADE)
    ratings = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student_id", "topic"], name="unique_assessment_per_student_topic")
        ]

    def __str__(self):
        return f"{self.student_id} - {self.topic.code}"


class ATLCategory(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class ATLSubskill(models.Model):
    category = models.ForeignKey(ATLCategory, related_name="subskills", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["category__order", "order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["category", "name"], name="unique_atl_subskill_per_category")
        ]

    def __str__(self):
        return self.name


class LearningContext(models.Model):
    grade = models.CharField(max_length=80, blank=True)
    subject_name = models.CharField(max_length=120)
    unit_name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    legacy_topic_code = models.CharField(max_length=80, unique=True, blank=True, null=True)

    class Meta:
        ordering = ["subject_name", "unit_name", "id"]

    def __str__(self):
        prefix = f"{self.grade} - " if self.grade else ""
        return f"{prefix}{self.subject_name}: {self.unit_name}"


class ContextATLMapping(models.Model):
    context = models.ForeignKey(LearningContext, related_name="mappings", on_delete=models.CASCADE)
    subskill = models.ForeignKey(ATLSubskill, related_name="context_mappings", on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["context__id", "order", "subskill__name"]
        constraints = [
            models.UniqueConstraint(fields=["context", "subskill"], name="unique_context_subskill_mapping")
        ]

    def __str__(self):
        return f"{self.context} - {self.subskill}"


class ContextRubricItem(models.Model):
    context = models.ForeignKey(LearningContext, related_name="rubric_items", on_delete=models.CASCADE)
    subskill = models.ForeignKey(ATLSubskill, related_name="rubric_items", on_delete=models.CASCADE)
    subskills = models.ManyToManyField(ATLSubskill, related_name="multi_rubric_items", blank=True)
    criteria_topic = models.CharField(max_length=160, blank=True)
    title = models.CharField(max_length=255)
    level_descriptors = models.JSONField(default=dict)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["context__id", "order", "title"]
        constraints = [
            models.UniqueConstraint(fields=["context", "title"], name="unique_context_rubric_item_title")
        ]

    def __str__(self):
        return self.title


class PairwiseComparison(models.Model):
    context = models.ForeignKey(LearningContext, related_name="pairwise_comparisons", on_delete=models.CASCADE)
    left_subskill = models.ForeignKey(ATLSubskill, related_name="left_pairwise_comparisons", on_delete=models.CASCADE)
    right_subskill = models.ForeignKey(ATLSubskill, related_name="right_pairwise_comparisons", on_delete=models.CASCADE)
    linguistic_scale = models.CharField(max_length=80)
    expert_user = models.CharField(max_length=120, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["context__id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["context", "left_subskill", "right_subskill"],
                name="unique_context_pairwise_direction",
            )
        ]

    def __str__(self):
        return f"{self.left_subskill} vs {self.right_subskill}"


class RubricScale(models.Model):
    code = models.CharField(max_length=12, unique=True)
    label = models.CharField(max_length=120)
    fuzzy_lower = models.FloatField()
    fuzzy_middle = models.FloatField()
    fuzzy_upper = models.FloatField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "code"]

    def __str__(self):
        return self.code


class StudentAssessment(models.Model):
    student_id = models.CharField(max_length=80)
    context = models.ForeignKey(LearningContext, related_name="student_assessments", on_delete=models.CASCADE)
    rubric_item = models.ForeignKey(ContextRubricItem, related_name="student_assessments", on_delete=models.CASCADE)
    rubric_scale = models.ForeignKey(RubricScale, related_name="student_assessments", on_delete=models.PROTECT)
    teacher_note = models.TextField(blank=True)
    evaluator = models.CharField(max_length=120, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["context__id", "student_id", "rubric_item__order"]
        constraints = [
            models.UniqueConstraint(
                fields=["student_id", "context", "rubric_item"],
                name="unique_student_context_rubric_assessment",
            )
        ]

    def __str__(self):
        return f"{self.student_id} - {self.rubric_item}"


class ContextWeightSnapshot(models.Model):
    context = models.OneToOneField(LearningContext, related_name="weight_snapshot", on_delete=models.CASCADE)
    subskill_weights = models.JSONField(default=dict)
    consistency_ratio = models.FloatField(default=0)
    debug = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Weights for {self.context}"
