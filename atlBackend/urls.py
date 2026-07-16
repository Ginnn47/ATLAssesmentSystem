"""
URL configuration for atl project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', views.auth_login_api),
    path('api/auth/logout/', views.auth_logout_api),
    path('api/auth/me/', views.auth_me_api),
    path('api/classes/', views.classes_api),
    path('api/classes/import-students/', views.class_students_import_api),
    path('api/users/', views.users_api),
    path('api/users/<int:user_id>/', views.user_detail_api),
    path('api/labels/', views.labels_api),
    path('api/students/', views.students_api),
    path('api/students/<int:student_id>/', views.student_detail_api),
    path('api/atl/hierarchy/', views.atl_hierarchy_api),
    path('api/contexts/', views.contexts_api),
    path('api/contexts/<str:context_id>/flow/', views.context_flow_api),
    path('api/contexts/<str:context_id>/subskills/', views.context_subskills_api),
    path('api/contexts/<str:context_id>/rubric-items/', views.context_rubric_items_api),
    path('api/contexts/<str:context_id>/pairwise/', views.context_pairwise_api),
    path('api/contexts/<str:context_id>/pairwise-scale/', views.context_pairwise_scale_api),
    path('api/contexts/<str:context_id>/pairwise-scale/reset/', views.context_pairwise_scale_reset_api),
    path('api/contexts/<str:context_id>/weights/calculate/', views.context_weights_calculate_api),
    path('api/contexts/<str:context_id>/weights/', views.context_weights_api),
    path('api/rubric-scales/', views.rubric_scales_api),
    path('api/topics/', views.topics_api),
    path('api/topics/<str:topic_id>/', views.topic_detail_api),
    path('api/topics/<str:topic_id>/criteria/', views.topic_criteria_api),
    path('api/criteria/<str:criterion_id>/', views.criterion_detail_api),
    path('api/fuzzy-ahp/calculate/', views.fuzzy_calculate_api),
    path('api/topics/<str:topic_id>/weights/', views.topic_weights_api),
    path('api/assessments/', views.assessments_api),
    path('api/assessments/preview/', views.assessments_preview_api),
    path('api/dashboard/', views.dashboard_api),
    path('api/students/analytics/', views.student_analytics_api),
    path('api/reports/', views.reports_api),
    path('api/reports/export/', views.reports_export_api),
]
