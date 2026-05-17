from django.contrib import admin

from .models import (
    ATLCategory,
    ATLSubskill,
    ContextATLMapping,
    ContextRubricItem,
    ContextWeightSnapshot,
    LearningContext,
    PairwiseComparison,
    RubricScale,
    StudentAssessment,
)


admin.site.register(ATLCategory)
admin.site.register(ATLSubskill)
admin.site.register(LearningContext)
admin.site.register(ContextATLMapping)
admin.site.register(ContextRubricItem)
admin.site.register(PairwiseComparison)
admin.site.register(RubricScale)
admin.site.register(StudentAssessment)
admin.site.register(ContextWeightSnapshot)
