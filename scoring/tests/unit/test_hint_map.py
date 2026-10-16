from scoring.hint_map import load_hint_map


def test_maps_espeak_variants_to_app_symbols() -> None:
    hm = load_hint_map()
    assert hm.to_app("ð") == "ð"
    assert hm.to_app("ˈɑː") == "ɑː"
    assert hm.to_app("ɒ") == "ɑː"
    assert hm.to_app("r") == "ɹ"
    assert hm.to_app("ɜː") == "ɚ"
    assert hm.to_app("eː") == "eɪ"  # tolerates length mark
    assert hm.to_app("☃") is None
    assert len(hm.app_symbols) >= 38
