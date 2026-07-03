import type { FaithBackground } from "@/generated/client";
import { CONSTITUTION } from "./constitution";

/**
 * Machine-optimized tradition blocks — one per FaithBackground — mirroring PHILOSOPHY_PROMPTS.
 * Terse and operative; the constitution + guardrails already carry the shared discipline, so
 * these only add what the tradition genuinely changes. Typed as Record<FaithBackground, string>
 * so tsc guarantees every enum value is covered.
 *
 * Human-facing source of record: the "Faith-Aware Generation" roadmap. NOTE: PROTESTANT and
 * OTHER_PROTESTANT both point at the generic-Protestant block (the enum collapse is a later
 * migration); the four Orthodox jurisdictions share one base plus a heritage line.
 */

const EASTERN_ORTHODOX_BASE =
  `- Scripture: Orthodox OT (Septuagint-based, broader than Protestant canon); read within the Church.
- Draw on: Church Fathers, the seven Ecumenical Councils, the liturgy, icons.
- Frame: theosis (union with God); mystery over exhaustive definition; continuity with the apostles.
- Avoid Western categories not shared (purgatory, Augustinian "original guilt").`;

const GENERIC_PROTESTANT =
  `- Scripture: Protestant canon (66), final authority.
- Frame: the shared Protestant core (grace through faith, the Bible as supreme authority, a personal lived faith).
- Lean on the family's notes; keep distinctives light.`;

export const FAITH_PROMPTS: Record<FaithBackground, string> = {
  ROMAN_CATHOLIC:
    `- Scripture: full Catholic canon (73 books incl. deuterocanon); prefer RSV-CE / NABRE / Douay-Rheims.
- Draw on: Catechism (Baltimore for young learners), the saints, Church Fathers.
- Frame: sacramental and incarnational; faith plus reason; Scripture plus Sacred Tradition together.
- Integrate invitationally; don't flatten into generic Protestant framing.`,

  EASTERN_CATHOLIC:
    `- Scripture: Catholic canon (73 books), Septuagint-influenced in places.
- Draw on: Catechism, Church Fathers, Byzantine/Eastern liturgy and icons.
- Frame: Catholic doctrine in communion with Rome, Eastern in spirituality (mystery, theosis, the Divine Liturgy).
- Distinct from both Roman-rite and Orthodox; integrate invitationally.`,

  EASTERN_ORTHODOX: EASTERN_ORTHODOX_BASE,
  GREEK_ORTHODOX: `${EASTERN_ORTHODOX_BASE}\n- Heritage: draw on the Greek patristic heritage.`,
  RUSSIAN_ORTHODOX: `${EASTERN_ORTHODOX_BASE}\n- Heritage: Slavic heritage and saints; feasts on the Julian calendar.`,
  OTHER_ORTHODOX: `${EASTERN_ORTHODOX_BASE}\n- Heritage: Oriental (Coptic/Armenian/Syriac/Ethiopian) — honor the family's named heritage; don't assume Chalcedonian vs non-Chalcedonian.`,

  LUTHERAN:
    `- Scripture: Protestant canon (66); read through law and gospel.
- Draw on: Luther's Small Catechism, the Book of Concord; a rich hymn tradition.
- Frame: grace alone through faith alone; the sacraments as true means of grace. Liturgical calendar.
- Bodies vary (confessional to mainline); don't assume a stance on contested issues.`,

  PRESBYTERIAN_REFORMED:
    `- Scripture: Protestant canon (66), supreme authority; high view of its coherence.
- Draw on: the Westminster Standards (or Heidelberg); strong catechetical tradition.
- Frame: the sovereignty of God; covenant theology; every subject as understanding God's world.
- Don't press debated points (e.g. predestination) into unrelated lessons.`,

  ANGLICAN_EPISCOPAL:
    `- Scripture: Protestant canon for doctrine; Apocrypha "for example of life".
- Draw on: the Book of Common Prayer, the creeds, the church year; the via media.
- Spans Anglo-Catholic to evangelical; don't assume one wing.`,

  METHODIST_WESLEYAN:
    `- Scripture: Protestant canon (66); read with tradition, reason, experience (the Wesleyan quadrilateral).
- Draw on: Wesley's sermons and hymns.
- Frame: grace at every step (prevenient, justifying, sanctifying); holiness of heart and life; faith in service.`,

  BAPTIST:
    `- Scripture: Protestant canon (66), final authority; translation-neutral (ESV/KJV/NASB/CSB) unless specified.
- Distinctives: believer's baptism by immersion, priesthood of all believers, local-church autonomy, personal relationship with Christ.
- Frame: conversion, discipleship, Scripture engagement and memory.
- Baptists span Calvinist and Arminian views — assume neither.`,

  PENTECOSTAL_CHARISMATIC:
    `- Scripture: Protestant canon (66), authoritative.
- Distinctives: the active work of the Holy Spirit, spiritual gifts, an experiential relationship with God, heartfelt worship.
- Practices vary widely; don't overstate specifics (e.g. tongues).`,

  CHURCH_OF_CHRIST:
    `- Scripture: Protestant canon (66); the NT as pattern ("speak where the Bible speaks").
- Distinctives: Restoration ("no creed but Christ"); weekly Lord's Supper; baptism for the forgiveness of sins; often a cappella.
- Congregations are autonomous and vary; don't assume the strictest reading.`,

  ANABAPTIST:
    `- Scripture: Protestant canon (66); the Sermon on the Mount especially central.
- Distinctives: discipleship, believer's baptism, peace and nonresistance, community, humility, simplicity.
- Spans Mennonite/Amish/Hutterite/Brethren; honor peace and simplicity without caricature.`,

  ADVENTIST:
    `- Scripture: Protestant canon (66), authoritative.
- STRUCTURAL: Sabbath = Friday sunset to Saturday sunset; treat Saturday as rest and worship, not schoolwork.
- Distinctives: wholeness of body and mind; the hope of Christ's return; often a creation emphasis.
- Ellen G. White = counsel, not Scripture.`,

  NONDENOMINATIONAL:
    `- Scripture: Protestant canon (66), final authority; translation-neutral unless specified.
- Frame: warm, Bible-centered evangelical faith (personal relationship with Jesus, the gospel of grace, everyday discipleship); light on denominational distinctives.
- Light touch, family-led.`,

  PROTESTANT: GENERIC_PROTESTANT,
  OTHER_PROTESTANT: GENERIC_PROTESTANT,

  OTHER:
    `- Defer fully to the family's stated faith notes; make no denominational assumptions; mirror their language and values; integrate respectfully and lightly.`,
};

/** The family-profile block (Phase 1: tradition only; conviction flags are added later). */
export function composeFamilyProfile(faith: FaithBackground | null | undefined): string {
  if (!faith) return "";
  const tradition = FAITH_PROMPTS[faith];
  if (!tradition) return "";
  return `<family_profile>
<tradition name="${faith}">
${tradition}
</tradition>
</family_profile>`;
}

/**
 * The full faith frame injected into a generation: the fixed constitution, then this family's
 * profile. Safe to call with a null faith (returns just the constitution — the frame is always on).
 */
export function composeFaithFrame(faith: FaithBackground | null | undefined): string {
  return [CONSTITUTION, composeFamilyProfile(faith)].filter(Boolean).join("\n\n");
}
