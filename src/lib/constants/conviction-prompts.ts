import type {
  OriginsStance,
  SexualityStance,
  SoteriologyStance,
  EschatologyStance,
  SpiritualGiftsStance,
  BibleStorylineStance,
  CatholicEmphasisStance,
  FaithBackground,
} from "@/generated/client";

/**
 * Machine-optimized conviction-flag strings. Each stance map is Record<Stance, string> so tsc
 * guarantees every enum value is covered. A null flag on the Classroom = "follow our tradition" and
 * emits nothing (silence never forces a position). Human-facing source: the roadmap + the
 * "Injectable Constants" spec. Bound at generation time by the constitution's moral floor + guardrails.
 */

/** The faith fields a Classroom carries; the composer reads these (a Classroom satisfies it). */
export interface FaithSelections {
  faithBackground?: FaithBackground | null;
  bibleTranslation?: string | null;
  confessions?: string[];
  origins?: OriginsStance | null;
  sexualityApproach?: SexualityStance | null;
  soteriology?: SoteriologyStance | null;
  eschatology?: EschatologyStance | null;
  spiritualGifts?: SpiritualGiftsStance | null;
  bibleStoryline?: BibleStorylineStance | null;
  catholicEmphasis?: CatholicEmphasisStance | null;
}

const ORIGINS: Record<OriginsStance, string> = {
  YOUNG_EARTH: `Lessons touching age of earth/cosmos/life: frame to a recent six-day creation, Scripture as history. Teach observational science fully; do NOT present deep-time dating or universal common descent as settled fact. May note in passing that most scientists hold otherwise; never assert it against the family. Never turn unrelated lessons into origins debates.`,
  OLD_EARTH: `Origins: an ancient universe/earth (mainstream dating) as compatible with Scripture — God as Creator over long ages, humanity specially created, a historical Adam. Teach astronomy/geology/physics mainstream on age; frame the special creation of humanity as the family's view.`,
  EVOLUTIONARY_CREATION: `Origins: present mainstream deep-time and biological evolution as the means through which God created; no conflict with a purposeful Creator. Avoid both young-earth framing and materialist "therefore no God" framing.`,
  MULTIPLE_VIEWS: `Origins: present the main Christian positions (young-earth, old-earth, evolutionary creation) and the mainstream scientific account, fairly and age-appropriately; don't declare a winner; represent each as its serious adherents would.`,
  MAINSTREAM_SCIENCE: `Origins: teach the age of the universe, geology, and biological evolution as standard, well-supported science, straightforwardly; keep it scientific, not anti-religious.`,
};

const SEXUALITY: Record<SexualityStance, string> = {
  TRADITIONAL: `Body/gender/sexuality topics: teach from a traditional biblical view (marriage as one man and one woman; sex within marriage; male and female as given). ALWAYS with compassion, never contempt — every person treated with dignity regardless of identity or lifestyle; no mocking or targeting (bound by the dignity floor). Age-appropriate; the family is the primary sex-education provider.`,
  FACTUAL_DEFER: `Body/gender/sexuality: give accurate, age-appropriate biology/health; leave moral and values framing to parents; do not advocate a position.`,
  AVOID: `Body/gender/sexuality: do not generate content on these topics; if unavoidable, stay minimal and clinical and defer to parents.`,
};

const SOTERIOLOGY: Record<SoteriologyStance, string> = {
  REFORMED_CALVINIST: `Salvation/grace content: frame from a Reformed view — God's sovereign, electing grace; salvation as His gift. Warm and worshipful, not a debate; don't press predestination into unrelated lessons.`,
  ARMINIAN_WESLEYAN: `Salvation: emphasize God's grace enabling a genuine human response and the call to respond in faith. Warm and invitational; not a free-will-vs-sovereignty argument.`,
};

const ESCHATOLOGY: Record<EschatologyStance, string> = {
  DISPENSATIONAL_PREMIL: `Prophecy/last-things: dispensational premillennial (future rapture, a literal millennial reign, a distinct future for Israel). Hopeful, Christ-centered, no date-setting.`,
  HISTORIC_PREMIL: `Last-things: historic premillennial (Christ's bodily return then His reign; no dispensational rapture/Israel-church split).`,
  AMILLENNIAL: `Last-things: amillennial (Christ presently reigning through the church; a single return, final judgment, new creation; the "millennium" symbolic).`,
  POSTMILLENNIAL: `Last-things: postmillennial (the gospel advances and renews the world before Christ's return). Mission-minded, hopeful.`,
  PRETERIST: `Last-things: preterist (much of prophecy, esp. Revelation/the Olivet Discourse, fulfilled in the first century; the final return and judgment still ahead).`,
};

const SPIRITUAL_GIFTS: Record<SpiritualGiftsStance, string> = {
  CONTINUATIONIST: `Spiritual gifts: present prophecy, tongues, and healing as continuing today. Warm, biblical, not sensational.`,
  CESSATIONIST: `Spiritual gifts: present the sign/revelatory gifts as ceased with the apostolic age, while fully honoring the Spirit's ongoing work (conversion, sanctification, providence). Not polemical.`,
  OPEN_CAUTIOUS: `Spiritual gifts: treat continuation as possible but with discernment; emphasize the Spirit's clear work without settling the debate.`,
};

const BIBLE_STORYLINE: Record<BibleStorylineStance, string> = {
  COVENANT: `Biblical-theology/prophecy: covenant theology — one unfolding covenant of grace, one people of God, strong Israel-church continuity, Christ as fulfillment.`,
  DISPENSATIONALISM: `Biblical-theology/prophecy: dispensationalism — distinct programs for Israel and the church, a literal prophetic hermeneutic, unfolding dispensations.`,
  PROGRESSIVE_DISPENSATIONALISM: `Biblical-theology/prophecy: progressive dispensationalism — already/not-yet; Christ has inaugurated the promises with a still-future consummation for Israel; soften the Israel/church divide.`,
  PROGRESSIVE_COVENANTALISM: `Biblical-theology/prophecy: progressive covenantalism — the covenants progressively unfolding and climaxing in Christ and the new covenant; no systematized covenant-of-grace or Israel/church dichotomy.`,
  NEW_COVENANT_THEOLOGY: `Biblical-theology/prophecy: new covenant theology — the old covenant fulfilled and superseded in the new covenant in Christ; the law of Christ as the believer's rule; continuity centered on Christ.`,
};

const CATHOLIC_EMPHASIS: Record<CatholicEmphasisStance, string> = {
  TRADITIONAL_LATIN_MASS: `Catholic content: traditional pre-Vatican II sensibility — the Traditional Latin Mass, classic devotions (rosary, saints, Latin), the Baltimore Catechism, Trent; don't present the Novus Ordo or modern ecumenical framing as the default.`,
  CONSERVATIVE_JPII_BENEDICT: `Catholic content: faithful post-Vatican II, read in continuity with tradition (John Paul II / Benedict XVI); grounded in the Catechism.`,
  MAINSTREAM: `Catholic content: ordinary post-Vatican II parish Catholic framing; Catechism-grounded.`,
  PROGRESSIVE: `Catholic content: emphasize the developmental, social-teaching, and ecumenical dimensions.`,
};

/** The affirmed-confessions block — a high-signal anchor for the model. */
export function composeConfession(confessions: string[] | null | undefined): string {
  if (!confessions || confessions.length === 0) return "";
  const list = confessions.join("; ");
  return `<confession affirms="${list}">Family affirms: ${list}. Align doctrinal content with these; do not contradict them.</confession>`;
}

/** The <convictions> block — emits only the flags the family actually set. */
export function composeConvictions(sel: FaithSelections): string {
  const lines: string[] = [];
  if (sel.bibleTranslation) {
    lines.push(
      `<scripture_translation>Quote all Scripture from the ${sel.bibleTranslation} (its wording and versification) unless the family says otherwise.</scripture_translation>`,
    );
  }
  if (sel.origins) lines.push(`<origins value="${sel.origins}">${ORIGINS[sel.origins]}</origins>`);
  if (sel.sexualityApproach) lines.push(`<sexuality value="${sel.sexualityApproach}">${SEXUALITY[sel.sexualityApproach]}</sexuality>`);
  if (sel.soteriology) lines.push(`<salvation value="${sel.soteriology}">${SOTERIOLOGY[sel.soteriology]}</salvation>`);
  if (sel.eschatology) lines.push(`<end_times value="${sel.eschatology}">${ESCHATOLOGY[sel.eschatology]}</end_times>`);
  if (sel.spiritualGifts) lines.push(`<spiritual_gifts value="${sel.spiritualGifts}">${SPIRITUAL_GIFTS[sel.spiritualGifts]}</spiritual_gifts>`);
  if (sel.bibleStoryline) lines.push(`<bible_storyline value="${sel.bibleStoryline}">${BIBLE_STORYLINE[sel.bibleStoryline]}</bible_storyline>`);
  if (sel.catholicEmphasis) lines.push(`<catholic_emphasis value="${sel.catholicEmphasis}">${CATHOLIC_EMPHASIS[sel.catholicEmphasis]}</catholic_emphasis>`);
  if (lines.length === 0) return "";
  return `<convictions>\n${lines.join("\n")}\n</convictions>`;
}
