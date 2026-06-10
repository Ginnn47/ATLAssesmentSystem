import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db import OperationalError, transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    AcademicPeriod,
    ATLSubskill,
    Assessment,
    ContextATLMapping,
    ContextRubricItem,
    ContextWeightSnapshot,
    Criterion,
    FuzzyWeight,
    LearningContext,
    PairwiseComparison,
    RubricScale,
    SchoolClass,
    Student,
    Subject,
    Topic,
    UserProfile,
)
from .services.catalog import get_students_catalog, get_students_for_class, student_to_dict, SUBJECTS
from .services.contextual_atl import (
    DEFAULT_LEVELS,
    LEGACY_ATL_SUBSKILL_MAP,
    build_context_report,
    build_context_scoring_config,
    calculate_context_ratings_preview,
    calculate_context_weights,
    context_flow_to_dict,
    context_to_dict,
    contexts_to_dict,
    ensure_contextual_seed,
    ensure_assessable_topic,
    generated_pairs,
    get_context,
    get_context_for_topic,
    get_pairwise_scale_options,
    hierarchy_to_dict,
    rubric_item_to_dict,
    rubric_scale_to_dict,
    reset_pairwise_scale_options,
    save_context_pairwise,
    selected_subskills,
    merged_assessments_for_context,
    normalize_rubric_subskills,
    subskills_for_names,
    subskill_to_dict,
    sync_criterion_to_context_rubric,
    sync_rubric_item_subskills,
    sync_assessment_payload,
    update_pairwise_scale_options,
)
from .services.FuzzyATLEquation import calculate_fuzzy_ahp
from .services.analytics import build_class_analytics
from .services.dashboard import build_dashboard_from_database
from .services.excel_export import EXCEL_MIME, build_report_workbook, safe_excel_filename
from .services.labels import get_label_registry
from .services.reports import build_reports


def api_response(data, status=200):
    return JsonResponse(data, status=status, safe=False)


def get_atl_profile(user):
    try:
        return user.atl_profile
    except UserProfile.DoesNotExist:
        return None


def default_profile_values_for(user):
    if user.is_superuser:
        return {
            "nip": "",
            "role_label": "Admin",
            "role_group": "Admin",
            "status": "Aktif",
        }
    return {
        "nip": "",
        "role_label": "PJ Mapel",
        "role_group": "PJ Mapel",
        "status": "Aktif",
    }


def ensure_default_profile(user):
    if not user.is_authenticated:
        return None
    profile = get_atl_profile(user)
    if profile:
        return profile
    if not user.is_superuser:
        return None
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults=default_profile_values_for(user),
    )
    return profile


def is_atl_user_active(user):
    if not user.is_authenticated or not user.is_active:
        return False
    if user.is_superuser:
        return True
    profile = get_atl_profile(user)
    return bool(profile and str(profile.status).strip().lower() in {"aktif", "active"})


def update_profile_login_label(user):
    profile = ensure_default_profile(user)
    if not profile:
        return
    profile.last_login_label = timezone.localtime(timezone.now()).strftime("%d %b %Y, %H:%M")
    profile.save(update_fields=["last_login_label"])


def parse_body(request):
    if not request.body:
        return {}
    try:
        parsed = json.loads(request.body.decode("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def require_authenticated_mutation(request):
    if request.method in {"GET", "OPTIONS"}:
        return None
    if is_atl_user_active(request.user):
        return None
    if request.user.is_authenticated:
        return api_response({"error": "ATL account is inactive or missing a profile"}, status=403)
    return api_response({"error": "Authentication required"}, status=401)


def class_to_dict(item):
    return {
        "id": item.id,
        "code": item.code,
        "displayName": item.display_name,
        "level": item.level,
        "isActive": item.is_active,
    }


def user_to_dict(user):
    profile = ensure_default_profile(user) or get_atl_profile(user)
    role_label = profile.role_label if profile else ("Admin" if user.is_superuser else "")
    role_group = profile.role_group if profile else ("Admin" if user.is_superuser else "")
    status = profile.status if profile else ("Aktif" if user.is_active else "Nonaktif")
    return {
        "id": user.id,
        "username": user.username,
        "name": user.get_full_name() or user.username,
        "email": user.email,
        "nip": profile.nip if profile else "",
        "roleLabel": role_label,
        "roleGroup": role_group,
        "role": role_label or role_group,
        "status": status,
        "lastLogin": profile.last_login_label if profile else (user.last_login.isoformat() if user.last_login else "-"),
        "classAccess": [item.code for item in profile.class_access.all()] if profile else [],
        "subjectAccess": [item.code for item in profile.subject_access.all()] if profile else [],
        "isStaff": user.is_staff,
        "isSuperuser": user.is_superuser,
    }


def get_school_class(value):
    if not value:
        return None
    return SchoolClass.objects.filter(code=value).first() or SchoolClass.objects.filter(display_name=value).first()


def active_period():
    return AcademicPeriod.objects.filter(is_active=True).first()
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def ensure_catalog():
    for subject_index, subject_data in enumerate(SUBJECTS):
        subject, _ = Subject.objects.get_or_create(
            code=subject_data["id"],
            defaults={"label": subject_data["label"]},
        )
        if subject.label != subject_data["label"]:
            subject.label = subject_data["label"]
            subject.save(update_fields=["label"])

        for topic_index, topic_data in enumerate(subject_data["topics"]):
            Topic.objects.get_or_create(
                code=topic_data["id"],
                defaults={
                    "subject": subject,
                    "label": topic_data["label"],
                    "description": topic_data.get("description", ""),
                    "order": subject_index * 100 + topic_index,
                },
            )
    ensure_contextual_seed()


def persist_context_weights_to_topic(context, result):
    if not context.legacy_topic_code:
        return None
    topic = Topic.objects.filter(code=context.legacy_topic_code).first()
    if not topic:
        return None
    weights = {
        **(result.get("weights") or {}),
        "packages": result.get("packages") or {},
    }
    record, _ = FuzzyWeight.objects.update_or_create(
        topic=topic,
        defaults={
            "weights": weights,
            "debug": result.get("debug") or {},
        },
    )
    return record


def persist_topic_weights_to_context(topic, weights, debug):
    context = LearningContext.objects.filter(legacy_topic_code=topic.code).first()
    if not context:
        return None
    snapshot_weights = dict(weights or {})
    packages = snapshot_weights.pop("packages", None) or (debug or {}).get("packages") or {}
    snapshot_debug = dict(debug or {})
    if packages:
        snapshot_debug["packages"] = packages
    snapshot, _ = ContextWeightSnapshot.objects.update_or_create(
        context=context,
        defaults={
            "subskill_weights": snapshot_weights,
            "consistency_ratio": 0,
            "debug": snapshot_debug,
        },
    )
    return snapshot


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def auth_login_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    payload = parse_body(request)
    username = payload.get("username") or payload.get("email") or ""
    password = payload.get("password") or ""
    user = authenticate(request, username=username, password=password)
    if user is None and "@" in username:
        match = User.objects.filter(email__iexact=username).first()
        if match:
            user = authenticate(request, username=match.username, password=password)
    if user is None:
        return api_response({"error": "Invalid username or password"}, status=400)
    if not is_atl_user_active(user):
        return api_response({"error": "ATL account is inactive or missing a profile"}, status=403)
    login(request, user)
    update_profile_login_label(user)
    return api_response({"user": user_to_dict(user)})


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def auth_logout_api(request):
    if request.method == "OPTIONS":
        return api_response({})
    logout(request)
    return api_response({"loggedOut": True})


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def auth_me_api(request):
    if request.method == "OPTIONS":
        return api_response({})
    if not is_atl_user_active(request.user):
        if request.user.is_authenticated:
            logout(request)
        return api_response({"user": None}, status=401)
    return api_response({"user": user_to_dict(request.user)})


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def classes_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        if request.method == "POST":
            payload = parse_body(request)
            code = (payload.get("code") or payload.get("name") or "").strip().upper().replace(" ", "")
            if not code:
                return api_response({"error": "Class code is required"}, status=400)
            item, _ = SchoolClass.objects.update_or_create(
                code=code,
                defaults={
                    "display_name": payload.get("displayName") or payload.get("display_name") or f"{code} - Primary",
                    "level": payload.get("level") or "Primary",
                    "is_active": payload.get("isActive", payload.get("is_active", True)),
                },
            )
            return api_response({"class": class_to_dict(item)}, status=201)

        return api_response({"classes": [class_to_dict(item) for item in SchoolClass.objects.all()]})
    except OperationalError:
        return api_response({"error": "Classes unavailable from database."}, status=503)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def users_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    if request.method == "GET":
        users = User.objects.prefetch_related("atl_profile__class_access", "atl_profile__subject_access").order_by("id")
        return api_response({"users": [user_to_dict(user) for user in users]})

    payload = parse_body(request)
    username = (payload.get("username") or payload.get("email") or payload.get("nip") or "").strip()
    if not username:
        return api_response({"error": "Username is required"}, status=400)
    name = (payload.get("name") or "").strip()
    first_name, _, last_name = name.partition(" ")
    try:
        user = User.objects.create_user(
            username=username,
            password=payload.get("password") or "atl12345",
            email=payload.get("email") or "",
            first_name=first_name,
            last_name=last_name,
            is_staff=payload.get("isStaff", False),
        )
    except IntegrityError:
        return api_response({"error": "Username already exists"}, status=400)
    profile = UserProfile.objects.create(
        user=user,
        nip=payload.get("nip") or "",
        role_label=payload.get("roleLabel") or payload.get("role_label") or "Guru / Evaluator",
        role_group=payload.get("roleGroup") or payload.get("role_group") or "PJ Mapel",
        status=payload.get("status") or "Aktif",
        last_login_label="-",
    )
    profile.class_access.set(SchoolClass.objects.filter(code__in=payload.get("classAccess") or []))
    profile.subject_access.set(Subject.objects.filter(code__in=payload.get("subjectAccess") or []))
    return api_response({"user": user_to_dict(user)}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "DELETE", "OPTIONS"])
def user_detail_api(request, user_id):
    if request.method == "OPTIONS":
        return api_response({})

    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return api_response({"error": "User not found"}, status=404)

    if request.method == "GET":
        return api_response({"user": user_to_dict(user)})
    if request.method == "DELETE":
        user.is_active = False
        user.save(update_fields=["is_active"])
        try:
            profile = user.atl_profile
        except UserProfile.DoesNotExist:
            profile = None
        if profile:
            profile.status = "Nonaktif"
            profile.save(update_fields=["status"])
        return api_response({"deleted": True})

    payload = parse_body(request)
    name = payload.get("name")
    if name:
        first_name, _, last_name = name.strip().partition(" ")
        user.first_name = first_name
        user.last_name = last_name
    if "email" in payload:
        user.email = payload.get("email") or ""
    if "isStaff" in payload:
        user.is_staff = bool(payload.get("isStaff"))
    if "password" in payload and payload.get("password"):
        user.set_password(payload["password"])
    user.is_active = payload.get("status", "Aktif") == "Aktif"
    user.save()

    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={"role_label": "Guru / Evaluator", "role_group": "PJ Mapel"},
    )
    profile.nip = payload.get("nip", profile.nip)
    profile.role_label = payload.get("roleLabel") or payload.get("role_label") or profile.role_label
    profile.role_group = payload.get("roleGroup") or payload.get("role_group") or profile.role_group
    profile.status = payload.get("status") or profile.status
    profile.save()
    if "classAccess" in payload:
        profile.class_access.set(SchoolClass.objects.filter(code__in=payload.get("classAccess") or []))
    if "subjectAccess" in payload:
        profile.subject_access.set(Subject.objects.filter(code__in=payload.get("subjectAccess") or []))
    return api_response({"user": user_to_dict(user)})


@require_http_methods(["GET", "OPTIONS"])
def labels_api(request):
    if request.method == "OPTIONS":
        return api_response({})
    return api_response(get_label_registry())


def topic_to_dict(topic):
    if topic.is_active:
        repair = ensure_assessable_topic(topic.code)
        context = repair.get("context")
        rubric_count = repair.get("rubricCount", 0)
    else:
        context = LearningContext.objects.filter(legacy_topic_code=topic.code).first()
        rubric_count = context.rubric_items.count() if context else topic.criteria.count()
        repair = {
            "contextAvailable": bool(context),
            "isAssessable": False,
        }
    return {
        "id": topic.code,
        "label": topic.label,
        "description": topic.description,
        "isActive": topic.is_active,
        "contextAvailable": repair.get("contextAvailable", bool(context)),
        "rubricCount": rubric_count,
        "isAssessable": repair.get("isAssessable", topic.is_active and rubric_count > 0),
        "contextId": context.id if context else None,
    }


def criterion_to_dict(criterion):
    atl_list = criterion.atl or []
    categories = []
    for item in atl_list:
        if isinstance(item, dict):
            category_name = (item.get("category") or {}).get("name") or ""
            categories.append(category_name)
        else:
            categories.append("")
    
    return {
        "id": criterion.id,
        "kriteria": criterion.name,
        "atl": atl_list,
        "categories": categories,
        "levels": criterion.levels or {},
    }


def get_topic(topic_id):
    ensure_catalog()
    return Topic.objects.get(code=topic_id, is_active=True)


def assessment_topic_error(topic_identifier, context_identifier=None):
    ensure_catalog()
    repair = ensure_assessable_topic(topic_identifier)
    topic = repair.get("topic")
    context = repair.get("context")

    if not topic:
        context_code = context_identifier or topic_identifier
        context = LearningContext.objects.filter(legacy_topic_code=context_code).first()
        if context and context.rubric_items.exists():
            subject_code = str(topic_identifier or "").split("_", 1)[0] or "singing"
            subject = (
                Subject.objects.filter(code=subject_code).first()
                or Subject.objects.filter(label=context.subject_name).first()
                or Subject.objects.first()
            )
            if subject:
                topic, _ = Topic.objects.update_or_create(
                    code=topic_identifier,
                    defaults={
                        "subject": subject,
                        "label": context.unit_name or str(topic_identifier).replace("_", " ").title(),
                        "description": context.description,
                        "order": subject.topics.count(),
                        "is_active": True,
                    },
                )
                repair = ensure_assessable_topic(topic_identifier)
                topic = repair.get("topic")

    if not topic or not topic.is_active:
        return api_response(
            {"error": "Topik ini belum tersedia untuk penilaian. Pilih topik aktif dari daftar pembelajaran."},
            status=404,
        )

    if repair.get("isAssessable"):
        return None

    return api_response(
        {"error": "Assessment belum tersedia, belum ada kriteria untuk mapel ini."},
        status=400,
    )


def context_criteria_to_legacy(context):
    criteria = []
    for item in context.rubric_items.select_related("subskill", "subskill__category").prefetch_related("subskills", "subskills__category").all():
        linked_subskills = list(item.subskills.all()) or [item.subskill]
        categories = []
        for subskill in linked_subskills:
            if subskill.category.name not in categories:
                categories.append(subskill.category.name)
        criteria.append(
            {
                "id": item.id,
                "criteriaTopic": item.criteria_topic,
                "kriteria": item.title,
                "atl": [subskill.name for subskill in linked_subskills],
                "levels": item.level_descriptors or DEFAULT_LEVELS,
                "subskillIds": [subskill.id for subskill in linked_subskills],
                "subskillId": linked_subskills[0].id if linked_subskills else item.subskill_id,
                "atlCategories": categories,
                "category": categories[0] if categories else item.subskill.category.name,
            }
        )
    return criteria


def find_subskill_for_payload(context, payload):
    value = payload.get("subskillId") or payload.get("subskill_id")
    if value:
        return ATLSubskill.objects.filter(id=value).first()

    name = payload.get("subskillName") or payload.get("subskill") or payload.get("atlName")
    if name:
        active = selected_subskills(context)
        for subskill in active:
            if subskill.name == name:
                return subskill
        return ATLSubskill.objects.filter(name=name).first()

    atl_values = payload.get("atl") or []
    if atl_values:
        mapped_name = LEGACY_ATL_SUBSKILL_MAP.get(atl_values[0], atl_values[0])
        active = selected_subskills(context)
        for subskill in active:
            if subskill.name == mapped_name:
                return subskill
        return ATLSubskill.objects.filter(name=mapped_name).first()

    return selected_subskills(context)[0] if selected_subskills(context) else None


def find_subskills_for_payload(payload):
    values = payload.get("subskillIds") or payload.get("subskill_ids") or []
    if values:
        subskills_by_id = {
            str(subskill.id): subskill
            for subskill in ATLSubskill.objects.filter(id__in=values).select_related("category")
        }
        return normalize_rubric_subskills(
            [subskills_by_id[str(value)] for value in values if str(value) in subskills_by_id]
        )

    names = payload.get("atl") or payload.get("subskillNames") or []
    if names:
        return normalize_rubric_subskills(subskills_for_names(names))

    category_names = payload.get("atlCategories") or payload.get("categories") or []
    if category_names:
        return normalize_rubric_subskills(
            list(ATLSubskill.objects.filter(category__name__in=category_names).select_related("category"))
        )

    return []


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def students_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    if request.method == "POST":
        payload = parse_body(request)
        school_class = get_school_class(payload.get("classCode") or payload.get("kelas") or payload.get("className"))
        if not school_class:
            return api_response({"error": "Valid class is required"}, status=400)
        nis = (payload.get("nis") or "").strip()
        full_name = (payload.get("name") or payload.get("fullName") or "").strip()
        if not nis or not full_name:
            return api_response({"error": "NIS and name are required"}, status=400)
        student, _ = Student.objects.update_or_create(
            nis=nis,
            defaults={
                "full_name": full_name,
                "school_class": school_class,
                "avatar_tone": payload.get("avatarTone") or "",
                "baseline_overall": payload.get("overall") or "",
                "baseline_strength": payload.get("strength") or "",
                "baseline_strength_value": payload.get("strengthValue") or "",
                "baseline_focus": payload.get("focus") or "",
                "baseline_trend_value": payload.get("trendValue") or "",
                "is_active": payload.get("isActive", True),
            },
        )
        return api_response({"student": student_to_dict(student)}, status=201)

    class_name = request.GET.get("class")
    catalog = get_students_catalog()
    if class_name:
        return api_response({"students": get_students_for_class(class_name), "classes": list(catalog.keys())})
    return api_response({"students": catalog, "classes": list(catalog.keys())})


@csrf_exempt
@require_http_methods(["GET", "POST", "PUT", "DELETE", "OPTIONS"])
def student_detail_api(request, student_id):
    if request.method == "OPTIONS":
        return api_response({})

    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        student = Student.objects.select_related("school_class").get(id=student_id)
    except (OperationalError, Student.DoesNotExist):
        return api_response({"error": "Student not found"}, status=404)

    if request.method == "GET":
        return api_response({"student": student_to_dict(student)})
    if request.method == "DELETE":
        student.is_active = False
        student.save(update_fields=["is_active"])
        return api_response({"deleted": True})

    payload = parse_body(request)
    school_class = get_school_class(payload.get("classCode") or payload.get("kelas") or payload.get("className"))
    if school_class:
        student.school_class = school_class
    student.nis = payload.get("nis", student.nis)
    student.full_name = payload.get("name") or payload.get("fullName") or student.full_name
    student.avatar_tone = payload.get("avatarTone", student.avatar_tone)
    student.baseline_overall = payload.get("overall", student.baseline_overall)
    student.baseline_strength = payload.get("strength", student.baseline_strength)
    student.baseline_strength_value = payload.get("strengthValue", student.baseline_strength_value)
    student.baseline_focus = payload.get("focus", student.baseline_focus)
    student.baseline_trend_value = payload.get("trendValue", student.baseline_trend_value)
    student.is_active = payload.get("isActive", student.is_active)
    student.save()
    return api_response({"student": student_to_dict(student)})


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def atl_hierarchy_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        return api_response(hierarchy_to_dict())
    except OperationalError:
        return api_response({"categories": []})


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def contexts_api(request):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        ensure_catalog()
        if request.method == "GET":
            return api_response(contexts_to_dict())

        payload = parse_body(request)
        legacy_topic_code = payload.get("legacyTopicCode") or payload.get("legacy_topic_code")
        subject_name = payload.get("subjectName") or payload.get("subject_name") or ""
        unit_name = payload.get("unitName") or payload.get("unit_name") or ""
        if legacy_topic_code:
            subject = (
                Subject.objects.filter(label=subject_name).first()
                or Subject.objects.filter(code=subject_name).first()
                or Subject.objects.first()
            )
            if subject:
                Topic.objects.update_or_create(
                    code=legacy_topic_code,
                    defaults={
                        "subject": subject,
                        "label": unit_name or legacy_topic_code.replace("_", " ").title(),
                        "description": payload.get("description") or "",
                        "order": subject.topics.count(),
                        "is_active": True,
                    },
                )
        if legacy_topic_code:
            context, _ = LearningContext.objects.update_or_create(
                legacy_topic_code=legacy_topic_code,
                defaults={
                    "grade": payload.get("grade") or "",
                    "subject_name": subject_name,
                    "unit_name": unit_name,
                    "description": payload.get("description") or "",
                },
            )
        else:
            context = LearningContext.objects.create(
                grade=payload.get("grade") or "",
                subject_name=subject_name,
                unit_name=unit_name,
                description=payload.get("description") or "",
                legacy_topic_code=None,
            )
        subskill_ids = payload.get("subskillIds") or []
        for order, subskill_id in enumerate(subskill_ids):
            subskill = ATLSubskill.objects.filter(id=subskill_id).first()
            if subskill:
                ContextATLMapping.objects.create(context=context, subskill=subskill, order=order, is_active=True)
        return api_response({"context": context_to_dict(context)}, status=201)
    except OperationalError:
        return api_response({"contexts": []} if request.method == "GET" else {"error": "Contexts unavailable"}, status=200 if request.method == "GET" else 503)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def context_flow_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        repair = ensure_assessable_topic(context_id) if not str(context_id).isdigit() else {}
        context = repair.get("context") or get_context(context_id)
        return api_response(context_flow_to_dict(context))
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def context_subskills_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        repair = ensure_assessable_topic(context_id) if not str(context_id).isdigit() else {}
        context = repair.get("context") or get_context(context_id)
        if request.method == "GET":
            return api_response({"subskills": [subskill_to_dict(item) for item in selected_subskills(context)]})

        payload = parse_body(request)
        subskill_ids = payload.get("subskillIds") or payload.get("subskills") or []
        ContextATLMapping.objects.filter(context=context).update(is_active=False)
        for order, subskill_id in enumerate(subskill_ids):
            subskill = ATLSubskill.objects.filter(id=subskill_id).first()
            if not subskill:
                continue
            ContextATLMapping.objects.update_or_create(
                context=context,
                subskill=subskill,
                defaults={"order": order, "is_active": True},
            )
        return api_response({"subskills": [subskill_to_dict(item) for item in selected_subskills(context)]})
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def context_rubric_items_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        repair = ensure_assessable_topic(context_id) if not str(context_id).isdigit() else {}
        context = repair.get("context") or get_context(context_id)
        if request.method == "GET":
            return api_response({"rubricItems": [rubric_item_to_dict(item) for item in context.rubric_items.all()]})

        payload = parse_body(request)
        subskills = find_subskills_for_payload(payload)
        subskill = subskills[0] if subskills else find_subskill_for_payload(context, payload)
        if not subskill:
            return api_response({"error": "Subskill is required"}, status=400)

        item = ContextRubricItem.objects.create(
            context=context,
            subskill=subskill,
            title=(payload.get("title") or payload.get("kriteria") or "").strip(),
            criteria_topic=payload.get("criteriaTopic") or payload.get("criteria_topic") or "",
            level_descriptors=payload.get("levelDescriptors") or payload.get("levels") or DEFAULT_LEVELS,
            order=context.rubric_items.count(),
        )
        selected_item_subskills = sync_rubric_item_subskills(item, subskills or [subskill])
        for index, linked_subskill in enumerate(selected_item_subskills):
            ContextATLMapping.objects.update_or_create(
                context=context,
                subskill=linked_subskill,
                defaults={"order": context.mappings.count() + index, "is_active": True},
            )
        return api_response({"rubricItem": rubric_item_to_dict(item)}, status=201)
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def context_pairwise_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        context = get_context(context_id)
        if request.method == "POST":
            payload = parse_body(request)
            save_context_pairwise(context, payload.get("pairwise") or payload.get("comparisons") or [], payload.get("expertUser") or "")
        return api_response(
            {
                "pairs": generated_pairs(context),
                "pairwise": [
                    {
                        "id": item.id,
                        "left": item.left_subskill.name,
                        "right": item.right_subskill.name,
                        "leftSubskillId": item.left_subskill_id,
                        "rightSubskillId": item.right_subskill_id,
                        "scale": item.linguistic_scale,
                    }
                    for item in PairwiseComparison.objects.filter(context=context).select_related("left_subskill", "right_subskill")
                ],
            }
        )
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["GET", "PUT", "OPTIONS"])
def context_pairwise_scale_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})
    if request.method == "PUT":
        guard = require_authenticated_mutation(request)
        if guard:
            return guard

    try:
        context = get_context(context_id)
        if request.method == "PUT":
            payload = parse_body(request)
            scale_options = update_pairwise_scale_options(context, payload.get("options") or [])
            return api_response({"scaleOptions": scale_options})
        return api_response({"scaleOptions": get_pairwise_scale_options(context)})
    except ValueError as error:
        return api_response({"error": str(error)}, status=400)
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def context_pairwise_scale_reset_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        context = get_context(context_id)
        return api_response({"scaleOptions": reset_pairwise_scale_options(context)})
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def context_weights_calculate_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        context = get_context(context_id)
        payload = parse_body(request)
        persist = payload.get("persist", True)
        result = calculate_context_weights(
            context,
            pairwise_payload=payload.get("pairwise") or payload.get("comparisons"),
            expert_user=payload.get("expertUser") or "",
            persist=persist,
        )
        if persist:
            persist_context_weights_to_topic(context, result)
        return api_response(result)
    except ValueError as error:
        return api_response({"error": str(error)}, status=400)
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def context_weights_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        context = get_context(context_id)
        flow = context_flow_to_dict(context)
        return api_response(
            {
                "weights": flow["weights"],
                "packages": (flow["debug"] or {}).get("packages") or {},
                "debug": flow["debug"],
                "consistency": flow["consistency"],
                "hasSavedWeight": flow["hasSavedWeight"],
                "weightSource": flow["weightSource"],
                "scaleOptions": flow.get("scaleOptions") or [],
            }
        )
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"weights": {}, "debug": {}, "consistency": None})


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def rubric_scales_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        ensure_catalog()
        return api_response({"rubricScales": [rubric_scale_to_dict(item) for item in RubricScale.objects.all()]})
    except OperationalError:
        return api_response({"rubricScales": []})


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def topics_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        ensure_catalog()
        subjects = []
        for subject in Subject.objects.prefetch_related("topics").order_by("code"):
            subjects.append(
                {
                    "id": subject.code,
                    "label": subject.label,
                    "topics": [topic_to_dict(topic) for topic in subject.topics.filter(is_active=True)],
                }
            )
        return api_response({"subjects": subjects})
    except OperationalError:
        return api_response({"error": "Topics unavailable from database.", "subjects": []}, status=503)


@csrf_exempt
@require_http_methods(["DELETE", "OPTIONS"])
def topic_detail_api(request, topic_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        topic = Topic.objects.get(code=topic_id, is_active=True)
        with transaction.atomic():
            LearningContext.objects.filter(legacy_topic_code=topic.code).delete()
            topic.is_active = False
            topic.save(update_fields=["is_active"])
        return api_response({"deleted": True, "topic": topic_to_dict(topic)})
    except Topic.DoesNotExist:
        return api_response({"error": "Topic not found"}, status=404)
    except OperationalError:
        return api_response({"error": "Topic unavailable from database."}, status=503)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def topic_criteria_api(request, topic_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        topic = get_topic(topic_id)
        if request.method == "GET":
            repair = ensure_assessable_topic(topic_id)
            try:
                context = repair.get("context") or get_context_for_topic(topic_id)
                context_criteria = context_criteria_to_legacy(context)
                if context_criteria:
                    return api_response({"criteria": context_criteria, "topic": topic_to_dict(topic)})
            except (LearningContext.DoesNotExist, OperationalError):
                pass
            criteria = [criterion_to_dict(item) for item in topic.criteria.all()]
            return api_response({"criteria": criteria, "topic": topic_to_dict(topic)})

        payload = parse_body(request)
        with transaction.atomic():
            order = topic.criteria.count()
            subskills = find_subskills_for_payload(payload)
            normalized_atl = [subskill.name for subskill in subskills] or payload.get("atl") or []
            criterion = Criterion.objects.create(
                topic=topic,
                name=(payload.get("kriteria") or payload.get("name") or "").strip(),
                atl=normalized_atl,
                levels=payload.get("levels") or {},
                order=order,
            )
            context = ensure_assessable_topic(topic_id).get("context")
            subskill = subskills[0] if subskills else find_subskill_for_payload(context, payload)
            if not context or not subskill:
                raise IntegrityError("Context rubric item could not be created.")
            rubric_item, _ = ContextRubricItem.objects.update_or_create(
                context=context,
                title=criterion.name,
                defaults={
                    "subskill": subskill,
                    "criteria_topic": payload.get("criteriaTopic") or payload.get("criteria_topic") or "",
                    "level_descriptors": criterion.levels or DEFAULT_LEVELS,
                    "order": context.rubric_items.count(),
                },
            )
            selected_item_subskills = sync_rubric_item_subskills(rubric_item, subskills or [subskill])
            for index, linked_subskill in enumerate(selected_item_subskills):
                ContextATLMapping.objects.update_or_create(
                    context=context,
                    subskill=linked_subskill,
                    defaults={"order": context.mappings.count() + index, "is_active": True},
                )
        return api_response({"criterion": criterion_to_dict(criterion), "topic": topic_to_dict(topic)}, status=201)
    except IntegrityError:
        return api_response({"error": "Gagal membuat context rubric untuk kriteria ini."}, status=400)
    except (OperationalError, Topic.DoesNotExist):
        return api_response({"criteria": []} if request.method == "GET" else {"error": "Topic unavailable"}, status=200 if request.method == "GET" else 503)


@csrf_exempt
@require_http_methods(["PUT", "DELETE", "OPTIONS"])
def criterion_detail_api(request, criterion_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        criterion = Criterion.objects.get(id=criterion_id)
        if request.method == "DELETE":
            topic = criterion.topic
            old_name = criterion.name
            old_atl = criterion.atl or []
            with transaction.atomic():
                criterion.delete()
                context = LearningContext.objects.filter(legacy_topic_code=topic.code).first()
                if context:
                    ContextRubricItem.objects.filter(context=context, title=old_name).delete()
                cleanup_references(topic, old_name, old_atl)
            return api_response({"deleted": True, "topic": topic_to_dict(topic)})

        payload = parse_body(request)
        old_name = criterion.name
        old_atl = criterion.atl or []
        subskills = find_subskills_for_payload(payload)
        with transaction.atomic():
            criterion.name = (payload.get("kriteria") or payload.get("name") or criterion.name).strip()
            criterion.atl = [subskill.name for subskill in subskills] or payload.get("atl") or []
            criterion.levels = payload.get("levels") or {}
            criterion.save()
            context = ensure_assessable_topic(criterion.topic.code).get("context")
            rubric_item = sync_criterion_to_context_rubric(criterion, context=context)
            if rubric_item:
                rubric_item.criteria_topic = payload.get("criteriaTopic") or payload.get("criteria_topic") or rubric_item.criteria_topic
                rubric_item.level_descriptors = criterion.levels or DEFAULT_LEVELS
                rubric_item.save(update_fields=["criteria_topic", "level_descriptors"])
            if old_name != criterion.name and context:
                ContextRubricItem.objects.filter(context=context, title=old_name).exclude(title=criterion.name).delete()
            sync_references(criterion.topic, old_name, old_atl, criterion.name, criterion.atl or [])
        return api_response({"criterion": criterion_to_dict(criterion), "topic": topic_to_dict(criterion.topic)})
    except Criterion.DoesNotExist:
        try:
            rubric_item = ContextRubricItem.objects.select_related("context", "subskill", "subskill__category").get(id=criterion_id)
            if request.method == "DELETE":
                rubric_item.delete()
                return api_response({"deleted": True})

            payload = parse_body(request)
            subskills = find_subskills_for_payload(payload)
            subskill = (subskills[0] if subskills else None) or find_subskill_for_payload(rubric_item.context, payload) or rubric_item.subskill
            rubric_item.title = (payload.get("kriteria") or payload.get("name") or rubric_item.title).strip()
            rubric_item.subskill = subskill
            rubric_item.criteria_topic = payload.get("criteriaTopic") or payload.get("criteria_topic") or rubric_item.criteria_topic
            rubric_item.level_descriptors = payload.get("levels") or payload.get("levelDescriptors") or rubric_item.level_descriptors
            rubric_item.save()
            selected_item_subskills = sync_rubric_item_subskills(rubric_item, subskills or [subskill])
            for index, linked_subskill in enumerate(selected_item_subskills):
                ContextATLMapping.objects.update_or_create(
                    context=rubric_item.context,
                    subskill=linked_subskill,
                    defaults={"order": rubric_item.context.mappings.count() + index, "is_active": True},
                )
            linked_subskills = list(rubric_item.subskills.select_related("category").all()) or [rubric_item.subskill]
            category_names = []
            for linked_subskill in linked_subskills:
                if linked_subskill.category.name not in category_names:
                    category_names.append(linked_subskill.category.name)
            return api_response(
                {
                    "criterion": {
                        "id": rubric_item.id,
                        "criteriaTopic": rubric_item.criteria_topic,
                        "kriteria": rubric_item.title,
                        "atl": [linked_subskill.name for linked_subskill in linked_subskills],
                        "levels": rubric_item.level_descriptors or {},
                        "subskillIds": [linked_subskill.id for linked_subskill in linked_subskills],
                        "subskillId": linked_subskills[0].id if linked_subskills else rubric_item.subskill_id,
                        "atlCategories": category_names,
                        "category": category_names[0] if category_names else rubric_item.subskill.category.name,
                    }
                }
            )
        except (OperationalError, ContextRubricItem.DoesNotExist):
            return api_response({"error": "Criterion unavailable"}, status=503)
    except OperationalError:
        return api_response({"error": "Criterion unavailable"}, status=503)


def cleanup_references(topic, criterion_name, atl_names):
    try:
        fuzzy_weight = FuzzyWeight.objects.filter(topic=topic).first()
        if fuzzy_weight:
            weights = dict(fuzzy_weight.weights or {})
            for atl_name in atl_names:
                weights.pop(f"{criterion_name} ({atl_name})", None)
            fuzzy_weight.weights = weights
            fuzzy_weight.save(update_fields=["weights", "updated_at"])

        for assessment in Assessment.objects.filter(topic=topic):
            ratings = dict(assessment.ratings or {})
            for atl_name in atl_names:
                ratings.pop(f"{topic.code}_{criterion_name}_{atl_name}", None)
            assessment.ratings = ratings
            assessment.save(update_fields=["ratings", "updated_at"])
    except OperationalError:
        return


def sync_references(topic, old_name, old_atl, new_name, new_atl):
    retained = [atl_name for atl_name in new_atl if atl_name in old_atl]
    removed = [atl_name for atl_name in old_atl if atl_name not in new_atl]
    try:
        fuzzy_weight = FuzzyWeight.objects.filter(topic=topic).first()
        if fuzzy_weight:
            weights = dict(fuzzy_weight.weights or {})
            for atl_name in retained:
                old_key = f"{old_name} ({atl_name})"
                new_key = f"{new_name} ({atl_name})"
                if old_key in weights and new_key not in weights:
                    weights[new_key] = weights[old_key]
                weights.pop(old_key, None)
            for atl_name in removed:
                weights.pop(f"{old_name} ({atl_name})", None)
            fuzzy_weight.weights = weights
            fuzzy_weight.save(update_fields=["weights", "updated_at"])

        for assessment in Assessment.objects.filter(topic=topic):
            ratings = dict(assessment.ratings or {})
            for atl_name in retained:
                old_key = f"{topic.code}_{old_name}_{atl_name}"
                new_key = f"{topic.code}_{new_name}_{atl_name}"
                if old_key in ratings and new_key not in ratings:
                    ratings[new_key] = ratings[old_key]
                ratings.pop(old_key, None)
            for atl_name in removed:
                ratings.pop(f"{topic.code}_{old_name}_{atl_name}", None)
            assessment.ratings = ratings
            assessment.save(update_fields=["ratings", "updated_at"])
    except OperationalError:
        return


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def fuzzy_calculate_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    payload = parse_body(request)
    result = calculate_fuzzy_ahp(
        payload.get("criteria") or [],
        payload.get("pairwise") or {},
        scale_options=payload.get("scaleOptions") or payload.get("scale_options"),
    )
    return api_response(result)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def topic_weights_api(request, topic_id):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        topic = get_topic(topic_id)
        if request.method == "GET":
            record = FuzzyWeight.objects.filter(topic=topic).first()
            return api_response({"weights": record.weights if record else {}, "debug": record.debug if record else {}})

        payload = parse_body(request)
        criteria = payload.get("criteria") or []
        pairwise = payload.get("pairwise") or payload.get("comparisons") or []
        if not criteria:
            return api_response(
                {"error": "Criteria dan pairwise diperlukan; bobot dari browser tidak diterima."},
                status=400,
            )
        result = calculate_fuzzy_ahp(
            criteria,
            pairwise,
            scale_options=payload.get("scaleOptions") or payload.get("scale_options"),
        )
        weights = result.get("weights") or {}
        debug = result.get("debug") or {}
        record, _ = FuzzyWeight.objects.update_or_create(
            topic=topic,
            defaults={"weights": weights, "debug": debug},
        )
        persist_topic_weights_to_context(topic, weights, debug)
        return api_response({"weights": record.weights, "debug": record.debug})
    except (OperationalError, Topic.DoesNotExist):
        return api_response({"weights": {}, "debug": {}} if request.method == "GET" else {"error": "Weights unavailable"}, status=200 if request.method == "GET" else 503)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def assessments_api(request):
    if request.method == "OPTIONS":
        return api_response({})
    guard = require_authenticated_mutation(request)
    if guard:
        return guard

    try:
        if request.method == "GET":
            topic_id = request.GET.get("topic")
            context_id = request.GET.get("context") or topic_id
            student_id = request.GET.get("student")
            if context_id:
                try:
                    repair = ensure_assessable_topic(context_id) if not str(context_id).isdigit() else {}
                    context = repair.get("context") or get_context(context_id)
                    topic = Topic.objects.filter(code=topic_id, is_active=True).first() if topic_id else None
                    merged = merged_assessments_for_context(context=context, topic=topic, student_id=student_id)
                    if merged:
                        return api_response({"assessments": merged})
                except (LearningContext.DoesNotExist, OperationalError):
                    pass

            queryset = Assessment.objects.select_related("topic")
            if topic_id:
                queryset = queryset.filter(topic__code=topic_id)
            if student_id:
                queryset = queryset.filter(student_id=str(student_id))

            assessments = {}
            for item in queryset:
                assessments.setdefault(str(item.student_id), {})[item.topic.code] = item.ratings or {}
            return api_response({"assessments": assessments})

        payload = parse_body(request)
        evaluator = request.user.get_full_name().strip() or request.user.username
        batch_items = payload.get("items")
        if batch_items is not None:
            if not isinstance(batch_items, list) or not batch_items:
                return api_response({"error": "Assessment items must be a non-empty array."}, status=400)

            normalized_items = []
            for item in batch_items:
                if not isinstance(item, dict):
                    return api_response({"error": "Each assessment item must be an object."}, status=400)
                topic_identifier = item.get("topic") or item.get("topicId")
                context_identifier = item.get("context") or item.get("contextId") or topic_identifier
                student_value = item.get("studentId") or item.get("student_id")
                if student_value is None or student_value == "" or not topic_identifier:
                    return api_response({"error": "Each assessment item requires studentId and topic."}, status=400)
                topic_guard = assessment_topic_error(topic_identifier, context_identifier)
                if topic_guard:
                    return topic_guard
                normalized_items.append(
                    (
                        str(student_value),
                        topic_identifier,
                        context_identifier,
                        item.get("ratings") or {},
                        item.get("teacherNote") or item.get("teacher_note") or "",
                    )
                )

            saved_items = []
            merged_assessments = {}
            with transaction.atomic():
                for student_id, topic_identifier, context_identifier, ratings, teacher_note in normalized_items:
                    record, assessments = sync_assessment_payload(
                        student_id=student_id,
                        topic_identifier=topic_identifier,
                        context_identifier=context_identifier,
                        ratings=ratings,
                        evaluator=evaluator,
                        teacher_note=teacher_note,
                    )
                    saved_items.append({"studentId": record.student_id, "topic": record.topic.code, "ratings": record.ratings})
                    for student_key, topic_map in assessments.items():
                        merged_assessments.setdefault(str(student_key), {}).update(topic_map or {})
            return api_response({"items": saved_items, "assessments": merged_assessments, "evaluator": evaluator})

        topic_identifier = payload.get("topic") or payload.get("topicId")
        context_identifier = payload.get("context") or payload.get("contextId") or topic_identifier
        student_value = payload.get("studentId") or payload.get("student_id")
        if student_value is None or student_value == "" or not topic_identifier:
            return api_response({"error": "studentId and topic are required."}, status=400)
        topic_guard = assessment_topic_error(topic_identifier, context_identifier)
        if topic_guard:
            return topic_guard
        record, assessments = sync_assessment_payload(
            student_id=str(student_value),
            topic_identifier=topic_identifier,
            context_identifier=context_identifier,
            ratings=payload.get("ratings") or {},
            evaluator=evaluator,
            teacher_note=payload.get("teacherNote") or payload.get("teacher_note") or "",
        )
        return api_response({"studentId": record.student_id, "topic": record.topic.code, "ratings": record.ratings, "assessments": assessments, "evaluator": evaluator})
    except Topic.DoesNotExist:
        return api_response(
            {"assessments": {}} if request.method == "GET" else {"error": "Topik ini belum tersedia untuk penilaian. Pilih topik aktif dari daftar pembelajaran."},
            status=200 if request.method == "GET" else 404,
        )
    except OperationalError:
        return api_response({"assessments": {}} if request.method == "GET" else {"error": "Database assessment belum tersedia."}, status=200 if request.method == "GET" else 503)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def assessments_preview_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    payload = parse_body(request)
    raw_items = payload.get("items")
    items = raw_items if raw_items is not None else [payload]
    if not isinstance(items, list) or not items:
        return api_response({"error": "Assessment preview items must be a non-empty array."}, status=400)

    scores = {}
    contexts = {}
    scoring_configs = {}
    try:
        for item in items:
            if not isinstance(item, dict):
                return api_response({"error": "Each assessment preview item must be an object."}, status=400)
            student_value = item.get("studentId") or item.get("student_id")
            context_identifier = item.get("context") or item.get("contextId") or item.get("topic") or item.get("topicId")
            ratings = item.get("ratings") or {}
            if student_value is None or student_value == "" or not context_identifier:
                return api_response({"error": "Each assessment preview item requires studentId and topic."}, status=400)
            if not isinstance(ratings, dict):
                return api_response({"error": "Assessment preview ratings must be an object."}, status=400)
            context_key = str(context_identifier)
            if context_key not in contexts:
                repair = ensure_assessable_topic(context_identifier) if not context_key.isdigit() else {}
                contexts[context_key] = repair.get("context") or get_context(context_identifier)
                if not contexts[context_key].rubric_items.exists():
                    return api_response({"error": "Belum bisa disimpan: kriteria belum tersedia."}, status=400)
                scoring_configs[context_key] = build_context_scoring_config(contexts[context_key])
            scores[str(student_value)] = calculate_context_ratings_preview(
                contexts[context_key],
                ratings,
                scoring_config=scoring_configs[context_key],
            )
        return api_response({"scores": scores})
    except LearningContext.DoesNotExist:
        return api_response({"error": "Assessment context was not found."}, status=404)
    except OperationalError:
        return api_response({"error": "Assessment preview unavailable."}, status=503)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def dashboard_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        ensure_catalog()
        return api_response(build_dashboard_from_database())
    except OperationalError:
        return api_response({"error": "Dashboard unavailable from database."}, status=503)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def student_analytics_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    payload = parse_body(request) if request.method == "POST" else {}
    class_name = request.GET.get("class") or payload.get("class") or "3A - Primary"
    try:
        ensure_catalog()
        topics = list(
            Topic.objects.filter(is_active=True)
            .select_related("subject")
            .prefetch_related("criteria")
            .order_by("subject__code", "order", "label")
        )
        contexts = list(
            LearningContext.objects.prefetch_related(
                "rubric_items",
                "rubric_items__subskill",
                "rubric_items__subskill__category",
                "rubric_items__subskills",
                "rubric_items__subskills__category",
            )
        )
        weights_by_topic = {
            item.topic.code: item.weights or {}
            for item in FuzzyWeight.objects.select_related("topic").all()
        }
        assessments = {}
        for item in Assessment.objects.select_related("topic").all():
            assessments.setdefault(str(item.student_id), {})[item.topic.code] = item.ratings or {}
        for context in contexts:
            contextual = merged_assessments_for_context(context=context)
            for student_key, topic_map in contextual.items():
                assessments.setdefault(str(student_key), {}).update(topic_map or {})
        return api_response(build_class_analytics(class_name, topics, contexts, weights_by_topic, assessments))
    except OperationalError:
        return api_response({"error": "Student analytics unavailable from database."}, status=503)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def reports_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    class_name = request.GET.get("class") or "3A - Primary"
    topic_id = request.GET.get("topic") or "singing_christmas_carol"
    context_id = request.GET.get("context") or topic_id
    try:
        if topic_id:
            ensure_assessable_topic(topic_id)
        try:
            context = get_context(context_id)
            if context.rubric_items.exists():
                return api_response(build_context_report(class_name, context))
        except (LearningContext.DoesNotExist, OperationalError):
            pass

        topic = get_topic(topic_id)
        criteria = [criterion_to_dict(item) for item in topic.criteria.all()]
        weights_record = FuzzyWeight.objects.filter(topic=topic).first()
        weights = weights_record.weights if weights_record else {}
        assessments = {
            str(item.student_id): item.ratings or {}
            for item in Assessment.objects.filter(topic=topic)
        }
        return api_response(build_reports(class_name, topic_id, criteria, weights, assessments, topic.subject.label, topic.label))
    except OperationalError:
        return api_response({"error": "Reports unavailable from database."}, status=503)
    except Topic.DoesNotExist:
        return api_response({"error": "Topic not found.", "students": [], "stats": {}, "meta": {"className": class_name, "topicId": topic_id}}, status=404)


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def reports_export_api(request):
    if request.method == "OPTIONS":
        response = HttpResponse(status=204)
    else:
        payload = parse_body(request)
        meta = payload.get("meta") or {}
        columns = payload.get("columns") or []
        rows = payload.get("rows") or []
        if not isinstance(columns, list) or not columns:
            response = api_response({"error": "Columns are required for Excel export."}, status=400)
            response["Access-Control-Expose-Headers"] = "Content-Disposition"
            return response
        if not isinstance(rows, list):
            response = api_response({"error": "Rows must be an array for Excel export."}, status=400)
            response["Access-Control-Expose-Headers"] = "Content-Disposition"
            return response
        filename = safe_excel_filename(meta.get("filename") or "ATL_Report")
        workbook = build_report_workbook(meta, columns, rows)
        response = HttpResponse(workbook, content_type=EXCEL_MIME)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

    response["Access-Control-Expose-Headers"] = "Content-Disposition"
    return response
