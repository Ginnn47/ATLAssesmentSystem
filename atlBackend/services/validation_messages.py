VALIDATION_MESSAGES = {
    "tfn_invalid": {
        "title": "Invalid TFN Scale",
        "message": "Nilai TFN harus memenuhi aturan lower <= middle <= upper dan seluruh nilai harus lebih besar dari 0.",
        "severity": "danger",
    },
    "scale_order_warning": {
        "title": "Scale Order Warning",
        "message": "Urutan intensitas pairwise belum konsisten. Scale lebih tinggi seharusnya punya nilai middle yang lebih besar.",
        "severity": "warning",
    },
    "reciprocal_valid": {
        "title": "Reciprocal Check Passed",
        "message": "Seluruh nilai reciprocal berhasil dibentuk otomatis dan sesuai dengan nilai pairwise utama.",
        "severity": "success",
    },
    "reciprocal_invalid": {
        "title": "Reciprocal Check Failed",
        "message": "Terdapat nilai reciprocal yang tidak sesuai dengan nilai pairwise utama.",
        "severity": "danger",
    },
    "saaty_valid": {
        "title": "Saaty Scale Check Passed",
        "message": "Seluruh nilai pairwise menggunakan pilihan scale yang tersedia pada konfigurasi sistem.",
        "severity": "success",
    },
    "saaty_invalid": {
        "title": "Invalid Pairwise Scale",
        "message": "Terdapat nilai pairwise yang tidak sesuai dengan scale yang tersedia.",
        "severity": "danger",
    },
    "cr_valid": {
        "title": "Consistency Check Passed",
        "message": "Consistency Ratio berada di bawah batas maksimum 0.10.",
        "severity": "success",
    },
    "cr_invalid": {
        "title": "Consistency Review Required",
        "message": "Consistency Ratio melebihi batas maksimum 0.10. Tinjau kembali pairwise sebelum bobot diterapkan.",
        "severity": "danger",
    },
    "transitivity_warning": {
        "title": "Potential Transitivity Issue",
        "message": "{criterion_a} > {criterion_b}, dan {criterion_b} > {criterion_c}, tetapi {criterion_a} terhadap {criterion_c} belum sejalan.",
        "severity": "warning",
    },
    "extreme_pairwise_warning": {
        "title": "Extreme Importance Warning",
        "message": "Nilai {scale_value} menunjukkan {criterion_a} sangat jauh lebih penting daripada {criterion_b}.",
        "severity": "warning",
    },
    "dominant_weight_warning": {
        "title": "Dominant Weight Warning",
        "message": "{criterion_a} memiliki bobot yang sangat dominan dibandingkan kriteria lain.",
        "severity": "warning",
    },
    "apply_locked": {
        "title": "Weight Cannot Be Applied",
        "message": "Bobot belum dapat diterapkan karena masih terdapat validasi yang perlu ditinjau.",
        "severity": "danger",
    },
}
