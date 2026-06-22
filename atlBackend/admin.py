from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User

from .models import (
    AcademicPeriod,
    ATLCategory,
    ATLSubskill,
    ContextATLMapping,
    ContextRubricItem,
    ContextWeightSnapshot,
    LearningContext,
    PairwiseComparison,
    PairwiseScaleOption,
    RubricScale,
    SchoolClass,
    Student,
    StudentAssessment,
    Subject,
    Topic,
    UserProfile,
)


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 1
    max_num = 1
    filter_horizontal = ("class_access", "subject_access")
    verbose_name = "ATL profile"
    verbose_name_plural = "ATL profile"


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ("username", "email", "first_name", "last_name", "is_staff", "is_active", "atl_role", "atl_status")
    list_filter = DjangoUserAdmin.list_filter + ("atl_profile__role_group", "atl_profile__status")

    @admin.display(description="ATL role")
    def atl_role(self, user):
        try:
            return user.atl_profile.role_label
        except UserProfile.DoesNotExist:
            return "Admin" if user.is_superuser else "-"

    @admin.display(description="ATL status")
    def atl_status(self, user):
        try:
            return user.atl_profile.status
        except UserProfile.DoesNotExist:
            return "Aktif" if user.is_superuser and user.is_active else "No profile"


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "nip", "role_label", "role_group", "status", "last_login_label")
    list_filter = ("role_group", "status", "class_access", "subject_access")
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email", "nip", "role_label")
    filter_horizontal = ("class_access", "subject_access")


@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ("code", "display_name", "level", "is_active")
    list_filter = ("level", "is_active")
    search_fields = ("code", "display_name")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "nis", "school_class", "baseline_overall", "is_active")
    list_filter = ("school_class", "is_active")
    search_fields = ("full_name", "nis")


@admin.register(StudentAssessment)
class StudentAssessmentAdmin(admin.ModelAdmin):
    list_display = ("student_id", "context", "rubric_item", "rubric_scale", "evaluator", "updated_at")
    list_filter = ("context", "rubric_scale", "academic_period")
    search_fields = ("student_id", "student_record__full_name", "rubric_item__title", "evaluator")


admin.site.register(AcademicPeriod)
admin.site.register(Subject)
admin.site.register(Topic)
admin.site.register(ATLCategory)
admin.site.register(ATLSubskill)
admin.site.register(LearningContext)
admin.site.register(ContextATLMapping)
admin.site.register(ContextRubricItem)
admin.site.register(PairwiseComparison)
admin.site.register(PairwiseScaleOption)
admin.site.register(RubricScale)
admin.site.register(ContextWeightSnapshot)

