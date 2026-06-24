import { EducationalPhilosophy } from "@/generated/client";

/**
 * Detailed pedagogical instructions for each educational philosophy.
 * These are injected into the Master Context to guide AI generation.
 */
export const PHILOSOPHY_PROMPTS: Record<string, string> = {
    [EducationalPhilosophy.CHARLOTTE_MASON]: `
PEDAGOGICAL METHOD: CHARLOTTE MASON
- **Living Books**: Prioritize narrative, literary sources over dry textbooks. Use rich language.
- **Narration**: Ask the student to tell back what they have learned in their own words rather than multiple-choice quizzes.
- **Short Lessons**: Keep activities concise to maintain maximum attention habit.
- **Atmosphere, Discipline, Life**: Education is a discipline of habit and a presentation of living ideas.
- **Nature Study**: Encourage observation of the natural world.
- **Content Style**: Use literary, story-driven explanations. Avoid talking down to the student.
`,
    [EducationalPhilosophy.CLASSICAL]: `
PEDAGOGICAL METHOD: CLASSICAL EDUCATION
- **The Trivium**: Align content with the student's stage (Grammar: facts/memorization, Logic: why/cause-effect, Rhetoric: expression/persuasion).
- **Great Books**: Reference primary sources and classic literature where possible.
- **Rigorous Structure**: Value logical ordering, clear definitions, and systematic mastery.
- **History-Centered**: Connect topics to their historical context.
- **Content Style**: Formal, structured, and academically rigorous.
`,
    [EducationalPhilosophy.MONTESSORI]: `
PEDAGOGICAL METHOD: MONTESSORI
- **Child-Led**: Follow the student's interests and pace.
- **Hands-On**: Prioritize tangible, physical activities and manipulatives over abstract theory.
- **Prepared Environment**: Suggest how to organize the physical space to facilitate learning.
- **Independence**: Design activities that the student can complete with minimal adult intervention ("Help me to do it myself").
- **Content Style**: Clear, simple instructions focused on processes and sensory experience.
`,
    [EducationalPhilosophy.UNSCHOOLING]: `
PEDAGOGICAL METHOD: UNSCHOOLING / SELF-DIRECTED
- **Interest-Based**: Heavily weigh the specific interests and passions of the student.
- **Real-World Application**: Connect learning immediately to real life, play, and practical skills.
- **No Formal "Lessons"**: Avoid scholastic language like "homework," "testing," or strict subjects. Frame learning as exploration.
- **Trust the Learner**: Assume the student wants to learn.
- **Content Style**: Conversational, inviting, and non-prescriptive.
`,
    [EducationalPhilosophy.UNIT_STUDIES]: `
PEDAGOGICAL METHOD: UNIT STUDIES
- **Thematic Integration**: Connect this specific topic to other subjects (Art, History, Science, Math) around a central theme.
- **Immersive**: Create a deep dive experience.
- **Multisensory**: Include varied activity types (reading, making, watching, doing).
- **Content Style**: Engaging, connected, and holistic.
`,
    [EducationalPhilosophy.WALDORF]: `
PEDAGOGICAL METHOD: WALDORF / STEINER
- **Head, Heart, Hands**: Engage the intellect, emotions, and physical body.
- **Artistic Approach**: Integrate storytelling, art, music, and rhythm into the lesson.
- **Developmental Appropriateness**: strictly adhere to the developmental stage (imagination for younger years).
- **No Early Academics**: For younger students, focus on play, fairy tales, and nature.
- **Content Style**: Imaginative, rhythmical, and artistic.
`,
    [EducationalPhilosophy.PROJECT_BASED_LEARNING]: `
PEDAGOGICAL METHOD: PROJECT-BASED LEARNING (PBL)
- **Driving Question**: Start with a compelling, open-ended question.
- **Real-World Problem**: Address a genuine challenge or creation.
- **Student Voice & Choice**: Allow options in how to demonstrate learning.
- **Public Product**: Work towards a shareable final artifact.
- **Content Style**: Problem-solving oriented, collaborative, and inquiring.
`,
    [EducationalPhilosophy.REGGIO_EMILIA]: `
PEDAGOGICAL METHOD: REGGIO EMILIA
- **Hundred Languages**: Encourage expression through drawing, sculpting, acting, etc.
- **Environment as Third Teacher**: Utilize the physical space and natural materials.
- **Project-Based**: Long-term, open-ended projects based on student curiosity.
- **Documentation**: Focus on recording the process of learning.
- **Content Style**: Respectful, exploratory, and community-focused.
`,
    [EducationalPhilosophy.WILD_AND_FREE]: `
PEDAGOGICAL METHOD: WILD & FREE
- **Nature-Heavy**: Prioritize time outdoors and connection with nature.
- **Reading-Rich**: Heavy emphasis on beautiful books and reading aloud.
- **Childhood Preservation**: Allow time for unstructured play and wonder.
- **Content Style**: Wholesome, gentle, and adventurous.
`,
    [EducationalPhilosophy.THOMAS_JEFFERSON_EDUCATION]: `
PEDAGOGICAL METHOD: THOMAS JEFFERSON EDUCATION (TJEd)
- **Classics**: Focus on classic works.
- **Mentors**: Emphasize the role of the parent/teacher as a mentor, not a taskmaster.
- **Inspire, Don't Require**: Focus on motivating the student to choose the work.
- **Phases of Learning**: Respect Core, Love of Learning, and Scholar phases.
- **Content Style**: Inspiring, principle-centered, and classic.
`,
    [EducationalPhilosophy.TRADITIONAL_SCHOOL_AT_HOME]: `
PEDAGOGICAL METHOD: TRADITIONAL / SCHOOL-AT-HOME
- **Structured**: Follow a clear scope and sequence.
- **Standard Subjects**: Treat subjects as distinct categories.
- **Mastery**: Focus on grading, testing, and verifying knowledge.
- **Content Style**: Clear, directive, and textbook-style.
`,
    [EducationalPhilosophy.VIRTUAL_ONLINE]: `
PEDAGOGICAL METHOD: VIRTUAL / ONLINE
- **Digital First**: Leverage digital tools, videos, and interactive apps.
- **Self-Paced**: Allow for flexibility in timing.
- **Modular**: Break content into consumable digital chunks.
- **Content Style**: Concise, visual, and interactive.
`,
    [EducationalPhilosophy.ROADSCHOOLING]: `
PEDAGOGICAL METHOD: ROADSCHOOLING
- **Place-Based**: Leverage the current location or travel destination.
- **Mobile-Friendly**: Activities that can be done in a car/RV or with minimal supplies.
- **Experiential**: Focus on museums, parks, and cultural sites.
- **Content Style**: Flexible, practical, and adventurous.
`,
    [EducationalPhilosophy.WORLDSCHOOLING]: `
PEDAGOGICAL METHOD: WORLDSCHOOLING
- **Global Perspective**: Connect topics to global cultures and geography.
- **Immersion**: Learn through experiencing new environments and cultures.
- **Content Style**: Culturally aware, broad-minded, and experiential.
`,
    [EducationalPhilosophy.GAMESCHOOLING]: `
PEDAGOGICAL METHOD: GAMESCHOOLING
- **Play-Based**: Use games (board, card, video) as the primary teacher.
- **Fun First**: Prioritize engagement and enjoyment.
- **Content Style**: Playful, competitive/cooperative, and rule-based.
`,
    [EducationalPhilosophy.ECLECTIC]: `
PEDAGOGICAL METHOD: ECLECTIC
- **Mix and Match**: Use the best tools from various methods.
- **Flexible**: Adapt to the specific needs of the child in the moment.
- **Content Style**: Balanced, practical, and adaptable.
`,
    [EducationalPhilosophy.OTHER]: `
PEDAGOGICAL METHOD: CUSTOM
- **Personalized**: Focus strictly on the student's specific needs and the family's stated preferences in their settings.
`
};
