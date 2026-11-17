"""The ledger of delivered films (engine/lib/ledger.py), offline: what two films share is judged by what is on
screen, not by names. What each film made for itself (its own beat, its own ending, its own score) is neither the
same nor different by its name, and goes to a reader in words; near colours count as one and greys as none; and
every film kept says its story in words for the story test and the review. Never touches ~/.chrishkai-video.

usage: python3 tests/ledger.test.py
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1] / "skills/creator-toy-intro"
HOME = tempfile.mkdtemp(prefix="ledger-home-")
os.environ["CHRISHKAI_VIDEO_HOME"] = HOME
sys.path.insert(0, str(SKILL / "engine/lib"))
import ledger  # noqa: E402


def film(**kw):
    e = {"id": "a", "name": "A", "date": "2026-11-01", "opening": "page-stand", "structure": ["page-stand", "count", "endCard"],
         "signature": "wave", "colours": ["#E8432E", "#1D9BF0", "#F6C445"], "sound": "song", "ending": "snail"}
    return {**e, **kw}


class Compare(unittest.TestCase):
    def test_the_same_ready_pieces_are_the_same(self):
        alike, own = ledger.same(film(), film(id="b"))
        self.assertEqual(alike, list(ledger.DIMS))
        self.assertEqual(own, [])

    def test_what_each_film_made_for_itself_is_not_the_same_by_name(self):
        a = film(structure=["page-stand", "own:medal", "endCard"], ending="own:grok-bots", sound="own")
        b = film(id="b", structure=["page-stand", "own:medal", "endCard"], ending="own:grok-bots", sound="own")
        alike, own = ledger.same(a, b)
        # the same file name in two films is two films' own pieces: a reader says whether they are alike
        for d in ("structure", "ending", "sound"):
            self.assertNotIn(d, alike)
            self.assertIn(d, own)

    def test_an_old_entrys_own_names_count_as_own(self):
        # a ledger kept before named a film's own beat by its file, its score by its id, its prop by its idea's words
        self.assertEqual(ledger.kind("piece", "beats/ig-stand.js"), "own")
        self.assertEqual(ledger.kind("sound", "score: kontec"), "own")
        self.assertEqual(ledger.kind("ending", "一轮落下一半的大夕阳"), "own")
        self.assertEqual(ledger.kind("ending", "plinth:pill"), "plinth:pill")
        self.assertEqual(ledger.kind("opening", "page-stand-left"), "page-stand-left")

    def test_two_reds_are_one_red_and_greys_are_no_colour(self):
        pairs, fewer = ledger.shared_colours(["#E8432E", "#FFFFFF", "#16171B"], ["#E04030", "#F5F5F5", "#9AA3AD"])
        self.assertEqual([a for a, _ in pairs], ["#E8432E"])
        self.assertEqual(fewer, 1)
        # a blue and a violet are two colours
        self.assertEqual(ledger.shared_colours(["#1D9BF0"], ["#7A5CF0"])[0], [])

    def test_colours_alike_takes_two_shared_hues_at_least(self):
        one = ledger.same(film(colours=["#E8432E", "#FFFFFF"]), film(id="b", colours=["#E04030", "#FFFFFF"]))[0]
        self.assertNotIn("colours", one)
        two = ledger.same(film(colours=["#E8432E", "#1D9BF0", "#2BB673"]), film(id="b", colours=["#E04030", "#1A98EE", "#F6C445"]))[0]
        self.assertIn("colours", two)

    def test_compare_puts_the_most_alike_first_and_leaves_this_film_out(self):
        rows = ledger.compare(film(), [film(), film(id="b", sound="bed"), film(id="c", opening="opening", sound="bed", ending="plinth")])
        self.assertEqual([e["id"] for e, _, _ in rows], ["b", "c"])


class Words(unittest.TestCase):
    def setUp(self):
        ledger.path().unlink(missing_ok=True)

    def test_every_skill_film_says_its_story_in_words(self):
        for e in ledger.base():
            self.assertTrue(e.get("story", {}).get("pitch"), e["id"])
            self.assertTrue(ledger.lines(e), e["id"])

    def test_a_film_kept_before_words_takes_the_skills_words(self):
        ledger.path().write_text(json.dumps([film(id="isnail", name="蜗牛King", film="/nowhere")]))
        got = {e["id"]: e for e in ledger.read()}
        self.assertFalse(got["isnail"].get("example"))  # this machine's, not an example
        self.assertTrue(got["isnail"]["story"]["pitch"])
        self.assertEqual(got["isnail"]["opening"], "page-stand")  # its own record wins on what it says

    def test_the_line_a_viewer_retells_is_kept_and_comes_first(self):
        e = film(id="told", story={"retold": "就是那个自称马斯克得不到、最后被官方认证的铁柱", "pitch": "From a wild fan to the official one"})
        self.assertEqual(ledger.lines(e)[0], "what a viewer retells: 就是那个自称马斯克得不到、最后被官方认证的铁柱")

    def test_stories_leave_out_this_film_and_films_with_no_words(self):
        ledger.path().write_text(json.dumps([film(id="bare")]))
        ids = [e["id"] for e, _ in ledger.stories(but="kingao")]
        self.assertNotIn("kingao", ids)
        self.assertNotIn("bare", ids)
        self.assertIn("isnail", ids)

    def test_the_story_test_reads_the_words_as_json(self):
        r = subprocess.run([sys.executable, str(SKILL / "engine/scripts/ledger.py"), "--words", "--but", "cgnot996"],
                           capture_output=True, text=True, env={**os.environ, "SKILL": str(SKILL)})
        self.assertEqual(r.returncode, 0, r.stderr)
        got = json.loads(r.stdout)
        self.assertEqual({f["name"] for f in got}, {"Kin", "蜗牛King"})
        self.assertTrue(all(f["words"] for f in got))

    def test_refresh_keeps_a_film_whose_folder_is_gone_and_takes_the_skills_record(self):
        ledger.path().write_text(json.dumps([film(id="gone", film="/nowhere/at/all"), film(id="kingao", date="2026-10-21")]))
        how = {e["id"]: (e, h) for e, h in ledger.refresh()}
        self.assertTrue(how["gone"][1].startswith("kept as it was"))
        self.assertEqual(how["kingao"][1], "the skill's own")
        self.assertEqual(how["kingao"][0]["date"], "2026-10-21")
        self.assertTrue(how["kingao"][0]["story"]["pitch"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
