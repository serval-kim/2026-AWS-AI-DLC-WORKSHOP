"""씬 정보 → Nova Reel 프롬프트 변환 (512자 이내)"""

PERSONA_BASE = (
    "A Korean male lawyer in navy suit and glasses, "
    "sitting at a desk with professional studio lighting, upper body shot, "
)

EMOTION_MAP = {
    "intro": "looking at camera with curious expression, slightly tilting head, raising one eyebrow",
    "analysis": "speaking passionately with animated hand gestures, pointing forward, serious expression",
    "conclusion": "stern authoritative expression, raising index finger decisively, declaring verdict",
}


def build_prompt(scene_name: str, shot_index: int, total_shots: int,
                 scene_description: str = "") -> str:
    """
    씬 이름 + 샷 위치 기반으로 프롬프트 생성.
    512자 이내 보장.
    """
    emotion = EMOTION_MAP.get(scene_name, EMOTION_MAP["analysis"])

    # 샷 위치에 따른 액션 변화
    if total_shots > 1:
        progress = shot_index / (total_shots - 1) if total_shots > 1 else 0
        if progress < 0.3:
            action = "beginning to speak"
        elif progress < 0.7:
            action = "gesturing emphatically"
        else:
            action = "concluding with firm gesture"
    else:
        action = "speaking directly to camera"

    prompt = f"{PERSONA_BASE}{emotion}, {action}"

    # 씬 설명 추가 (공간 허용 시)
    if scene_description and len(prompt) + len(scene_description) + 20 < 512:
        prompt += f", explaining: {scene_description[:100]}"

    return prompt[:512]
