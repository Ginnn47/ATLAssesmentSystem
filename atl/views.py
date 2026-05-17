import json

from django.db import OperationalError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    ATLSubskill,
    Assessment,
    ContextATLMapping,
    ContextRubricItem,
    Criterion,
    FuzzyWeight,
    LearningContext,
    PairwiseComparison,
    RubricScale,
    Subject,
    Topic,
)
from .services.catalog import STUDENTS, SUBJECTS
from .services.contextual_atl import (
    DEFAULT_LEVELS,
    LEGACY_ATL_SUBSKILL_MAP,
    build_context_report,
    calculate_context_weights,
    context_flow_to_dict,
    context_to_dict,
    contexts_to_dict,
    ensure_contextual_seed,
    generated_pairs,
    get_context,
    get_context_for_topic,
    hierarchy_to_dict,
    rubric_item_to_dict,
    rubric_scale_to_dict,
    save_context_pairwise,
    selected_subskills,
    student_assessments_to_legacy,
    subskill_to_dict,
    upsert_student_assessments_from_ratings,
)
from .services.fuzzy_ahp import calculate_fuzzy_ahp
from .services.reports import build_reports


def api_response(data, status=200):
    response = JsonResponse(data, status=status, safe=False)
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def parse_body(request):
    if not request.body:
        return {}
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


def topic_to_dict(topic):
    return {
        "id": topic.code,
        "label": topic.label,
        "description": topic.description,
    }


def criterion_to_dict(criterion):
    return {
        "id": criterion.id,
        "kriteria": criterion.name,
        "atl": criterion.atl or [],
        "levels": criterion.levels or {},
    }


def get_topic(topic_id):
    ensure_catalog()
    return Topic.objects.get(code=topic_id)


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
        return list(ATLSubskill.objects.filter(id__in=values).select_related("category"))

    names = payload.get("atl") or payload.get("subskillNames") or []
    if names:
        return list(ATLSubskill.objects.filter(name__in=names).select_related("category"))

    category_names = payload.get("atlCategories") or payload.get("categories") or []
    if category_names:
        return list(ATLSubskill.objects.filter(category__name__in=category_names).select_related("category"))

    return []


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def students_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    class_name = request.GET.get("class")
    if class_name:
        return api_response({"students": STUDENTS.get(class_name, []), "classes": list(STUDENTS.keys())})
    return api_response({"students": STUDENTS, "classes": list(STUDENTS.keys())})


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

    try:
        ensure_catalog()
        if request.method == "GET":
            return api_response(contexts_to_dict())

        payload = parse_body(request)
        legacy_topic_code = payload.get("legacyTopicCode") or payload.get("legacy_topic_code")
        context = LearningContext.objects.create(
            grade=payload.get("grade") or "",
            subject_name=payload.get("subjectName") or payload.get("subject_name") or "",
            unit_name=payload.get("unitName") or payload.get("unit_name") or "",
            description=payload.get("description") or "",
            legacy_topic_code=legacy_topic_code or None,
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
        context = get_context(context_id)
        return api_response(context_flow_to_dict(context))
    except (OperationalError, LearningContext.DoesNotExist):
        return api_response({"error": "Context unavailable"}, status=404)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def context_subskills_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        context = get_context(context_id)
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

    try:
        context = get_context(context_id)
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
        item.subskills.set(subskills or [subskill])
        for index, linked_subskill in enumerate(subskills or [subskill]):
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
@require_http_methods(["POST", "OPTIONS"])
def context_weights_calculate_api(request, context_id):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        context = get_context(context_id)
        payload = parse_body(request)
        result = calculate_context_weights(
            context,
            pairwise_payload=payload.get("pairwise") or payload.get("comparisons"),
            expert_user=payload.get("expertUser") or "",
            persist=True,
        )
        return api_response(result)
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
        return api_response({"weights": flow["weights"], "debug": flow["debug"], "consistency": flow["consistency"]})
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
                    "topics": [topic_to_dict(topic) for topic in subject.topics.all()],
                }
            )
        return api_response({"subjects": subjects})
    except OperationalError:
        return api_response({"subjects": SUBJECTS})


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def topic_criteria_api(request, topic_id):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        topic = get_topic(topic_id)
        if request.method == "GET":
            try:
                context = get_context_for_topic(topic_id)
                context_criteria = context_criteria_to_legacy(context)
                if context_criteria:
                    return api_response({"criteria": context_criteria})
            except (LearningContext.DoesNotExist, OperationalError):
                pass
            criteria = [criterion_to_dict(item) for item in topic.criteria.all()]
            return api_response({"criteria": criteria})

        payload = parse_body(request)
        order = topic.criteria.count()
        criterion = Criterion.objects.create(
            topic=topic,
            name=(payload.get("kriteria") or payload.get("name") or "").strip(),
            atl=payload.get("atl") or [],
            levels=payload.get("levels") or {},
            order=order,
        )
        try:
            context = get_context_for_topic(topic_id)
            subskills = find_subskills_for_payload(payload)
            subskill = subskills[0] if subskills else find_subskill_for_payload(context, payload)
            if subskill:
                for index, linked_subskill in enumerate(subskills or [subskill]):
                    ContextATLMapping.objects.update_or_create(
                        context=context,
                        subskill=linked_subskill,
                        defaults={"order": context.mappings.count() + index, "is_active": True},
                    )
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
                rubric_item.subskills.set(subskills or [subskill])
        except (LearningContext.DoesNotExist, OperationalError):
            pass
        return api_response({"criterion": criterion_to_dict(criterion)}, status=201)
    except (OperationalError, Topic.DoesNotExist):
        return api_response({"criteria": []} if request.method == "GET" else {"error": "Topic unavailable"}, status=200 if request.method == "GET" else 503)


@csrf_exempt
@require_http_methods(["PUT", "DELETE", "OPTIONS"])
def criterion_detail_api(request, criterion_id):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        criterion = Criterion.objects.get(id=criterion_id)
        if request.method == "DELETE":
            topic = criterion.topic
            old_name = criterion.name
            old_atl = criterion.atl or []
            criterion.delete()
            cleanup_references(topic, old_name, old_atl)
            return api_response({"deleted": True})

        payload = parse_body(request)
        old_name = criterion.name
        old_atl = criterion.atl or []
        criterion.name = (payload.get("kriteria") or payload.get("name") or criterion.name).strip()
        criterion.atl = payload.get("atl") or []
        criterion.levels = payload.get("levels") or {}
        criterion.save()
        sync_references(criterion.topic, old_name, old_atl, criterion.name, criterion.atl or [])
        return api_response({"criterion": criterion_to_dict(criterion)})
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
            rubric_item.subskills.set(subskills or [subskill])
            for index, linked_subskill in enumerate(subskills or [subskill]):
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
    result = calculate_fuzzy_ahp(payload.get("criteria") or [], payload.get("pairwise") or {})
    return api_response(result)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def topic_weights_api(request, topic_id):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        topic = get_topic(topic_id)
        if request.method == "GET":
            record = FuzzyWeight.objects.filter(topic=topic).first()
            return api_response({"weights": record.weights if record else {}, "debug": record.debug if record else {}})

        payload = parse_body(request)
        record, _ = FuzzyWeight.objects.update_or_create(
            topic=topic,
            defaults={"weights": payload.get("weights") or {}, "debug": payload.get("debug") or {}},
        )
        return api_response({"weights": record.weights, "debug": record.debug})
    except (OperationalError, Topic.DoesNotExist):
        return api_response({"weights": {}, "debug": {}} if request.method == "GET" else {"error": "Weights unavailable"}, status=200 if request.method == "GET" else 503)


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def assessments_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    try:
        if request.method == "GET":
            topic_id = request.GET.get("topic")
            context_id = request.GET.get("context") or topic_id
            student_id = request.GET.get("student")
            if context_id:
                try:
                    context = get_context(context_id)
                    contextual = student_assessments_to_legacy(context, student_id=student_id)
                    if contextual:
                        return api_response({"assessments": contextual})
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
        topic_identifier = payload.get("topic") or payload.get("topicId")
        context_identifier = payload.get("context") or payload.get("contextId") or topic_identifier
        student_id = str(payload.get("studentId") or payload.get("student_id"))
        try:
            context = get_context(context_identifier)
            upsert_student_assessments_from_ratings(
                student_id,
                context,
                payload.get("ratings") or {},
                evaluator=payload.get("evaluator") or "",
            )
        except (LearningContext.DoesNotExist, OperationalError):
            pass

        topic = get_topic(topic_identifier)
        record, _ = Assessment.objects.update_or_create(
            student_id=student_id,
            topic=topic,
            defaults={"ratings": payload.get("ratings") or {}},
        )
        return api_response({"studentId": record.student_id, "topic": topic.code, "ratings": record.ratings})
    except (OperationalError, Topic.DoesNotExist):
        return api_response({"assessments": {}} if request.method == "GET" else {"error": "Assessment unavailable"}, status=200 if request.method == "GET" else 503)


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def reports_api(request):
    if request.method == "OPTIONS":
        return api_response({})

    class_name = request.GET.get("class") or "3A - Primary"
    topic_id = request.GET.get("topic") or "singing_christmas_carol"
    context_id = request.GET.get("context") or topic_id
    try:
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
    except (OperationalError, Topic.DoesNotExist):
        return api_response({"students": [], "stats": {}, "meta": {"className": class_name, "topicId": topic_id}})
