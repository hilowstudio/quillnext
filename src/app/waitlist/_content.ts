/**
 * All landing-page copy lives here as typed data — one review surface, and the single thing the
 * voice-lint test (`_content.test.ts`) guards. Two personas, one rulebook: the Calm Integrator for
 * operational copy, the Reformed Theological Mind for the founder note + discipleship section. The
 * test fails the build on any em dash or banned word, so keep prose clean here.
 */

export const SCHOOL_YEAR = "2026-27";
export const CONTACT_EMAIL = "adam@quillandcompass.app";

export interface Faq {
    q: string;
    a: string;
}

export interface Feature {
    id: string;
    eyebrow: string;
    headline: string;
    body: string;
    faqs: Faq[];
}

export interface Pillar {
    title: string;
    body: string;
}

export const hero = {
    headline: "Homeschool that runs on rest.",
    sub:
        "You shouldn't be building curriculum at 11pm. Quill & Compass plans the week, drafts the " +
        "lessons, grounds them in real books and a real K-12 spine, and keeps the records. " +
        "Discipleship is built in. Your attention and your data stay yours.",
    microcopy: `For the ${SCHOOL_YEAR} school year. I'll email once. No spam, no selling your address, ever.`,
};

export const founderNote = {
    heading: "Why this exists",
    paragraphs: [
        "I built this after watching good parents run their homes on willpower alone. The curriculum " +
            "gets made after the kids are asleep. The week lives in your head, which is already full. By " +
            "February the read-alouds and family worship are the first to fall off, because they're the " +
            "things with no deadline.",
        "Most of that is a working-memory problem. Naming it that way changes the fix. So Quill & Compass " +
            "holds the structure: the plan, the lessons, the records, the verse for the week. It asks for " +
            "almost none of your attention back, so you can give that attention to the children in front of you.",
        "One honest word. Software doesn't disciple your children. The Spirit does that, through the Word, " +
            "through prayer, through the ordinary faithfulness of a parent and a church. This tool keeps the " +
            "table set, so the good things stay daily.",
    ],
    signoff: "Adam, builder of Quill & Compass",
};

export const grounding = {
    heading: "Three things, working as one.",
    intro:
        "Good teaching needs three things at once: the map, the right book open, and a real sense of " +
        "the child. Quill & Compass holds all three and hands them to the AI together.",
    pillars: [
        {
            title: "The spine",
            body: "A real K-12 scope and sequence, so every lesson has a place in the year.",
        },
        {
            title: "Your library",
            body: "The books and videos you chose, read and ready, so lessons quote real sources.",
        },
        {
            title: "Your child",
            body: "A profile of how each one learns, so the work fits the kid.",
        },
    ] as Pillar[],
    close:
        "Generate anything and it draws on all three at once. That's why the output sounds like your " +
        "homeschool instead of a stranger's.",
};

export const features: Feature[] = [
    {
        id: "generation",
        eyebrow: "AI generation",
        headline: "Lessons that are actually yours.",
        body:
            "You sit down to make a worksheet and lose an hour to formatting. Quill & Compass drafts the " +
            "lesson, the quiz, the reading guide, in the time it takes to pour coffee. You pick the subject " +
            "and the child; it writes content aimed at where that child actually is. Every piece comes out " +
            "marked as a draft for you to read and approve. You stay the teacher. The machine does the typing.",
        faqs: [
            {
                q: "Is this just ChatGPT with a logo?",
                a:
                    "It's grounded. Every generation is built from your child's profile, the objective you " +
                    "chose, and the books on your shelf, then checked against the source text so the facts " +
                    "hold. A blank chat box gives you none of that structure.",
            },
            {
                q: "Can I edit what it makes?",
                a:
                    "Yes. Everything is a starting draft. Keep it, rewrite it, or regenerate with a note about " +
                    "what to change.",
            },
            {
                q: "What can it make?",
                a:
                    "Lessons and readings, worksheets, quizzes, slides, and full unit bundles you can drop " +
                    "straight into a course.",
            },
        ],
    },
    {
        id: "spine",
        eyebrow: "The academic spine",
        headline: "Always know what's next.",
        body:
            "Most curriculum anxiety is a planning-load problem wearing a scary mask. Quill & Compass ships " +
            "with a full K-12 scope and sequence already built: twelve subjects broken into thousands of " +
            "specific objectives, kindergarten through high school. Pick where your child is and the next " +
            "right thing is in front of you. The plan exists before you sit down.",
        faqs: [
            {
                q: "Do I have to follow your sequence?",
                a:
                    "No. It's there when you want a track to stand on. Teach off it, ahead of it, or around " +
                    "it. Add your own topics and it stretches to fit.",
            },
            {
                q: "What subjects are covered?",
                a:
                    "The usual academics (math, science, language arts, history, geography, the arts) plus " +
                    "Bible and theology, life and home skills, and digital discipleship as real subjects.",
            },
            {
                q: "Is it aligned to standards?",
                a:
                    "It's a coherent K-12 progression you can teach with confidence. Each objective carries a " +
                    "grade level and a difficulty, so a lesson lands at the right height.",
            },
        ],
    },
    {
        id: "library",
        eyebrow: "The Living Library",
        headline: "Your bookshelf, finally doing some teaching.",
        body:
            "You already own the good stuff. Living books, the science text, the documentary you keep " +
            "meaning to use. Add a book by scanning its barcode or photographing the cover, and Quill & " +
            "Compass reads it, outlines it, and remembers it. Generate a lesson from that book and it pulls " +
            "from the actual pages, with real quotes about your title. Add a book once and the heavy reading " +
            "is done for every family who adds it after you.",
        faqs: [
            {
                q: "Do I have to type the whole book in?",
                a:
                    "No. Scan the barcode, search the title, or snap the cover. We pull the details, and for " +
                    "public-domain works, the full text.",
            },
            {
                q: "Will it summarize, or actually use my book?",
                a:
                    "It uses your book. Lessons quote and reference the real text, with a check that catches " +
                    "anything invented.",
            },
            {
                q: "What can I add?",
                a:
                    "Books, YouTube videos (it reads the transcript), web articles, and your own documents. " +
                    "They all become material a lesson can draw from.",
            },
        ],
    },
    {
        id: "personalization",
        eyebrow: "Built for each learner",
        headline: "Built around each child.",
        body:
            "One worksheet for three different children serves none of them well. Each learner gets a short " +
            "profile: how they learn, what lights them up, where they need a gentler on-ramp. Quill & Compass " +
            "folds that into everything it writes, so the lesson for your hands-on nine-year-old reads " +
            "differently from the one for your bookish thirteen-year-old. You can see exactly what the AI " +
            "knows about each child, and fix it, on one page.",
        faqs: [
            {
                q: "How does it learn about my kid?",
                a:
                    "A short set of questions per child about personality, learning style, and interests. " +
                    "Update it any time, and read the whole profile in plain language.",
            },
            {
                q: "Can I see what the AI is using?",
                a:
                    "Yes. A context page shows the exact picture each generation is built from, scored for " +
                    "completeness, with simple ways to fill the gaps.",
            },
        ],
    },
    {
        id: "thinkling",
        eyebrow: "Student AI, with a safety layer",
        headline: "AI your kids can use, that you can trust.",
        body:
            "Thinkling is a tutor your child can talk to, built to ask good questions instead of handing " +
            "over answers. Three modes: subject help, research, and college-and-career. Underneath runs a " +
            "safety layer that reads every message a child sends for signs of harm, built to fail safe. If a " +
            "child is in real trouble, it surfaces verified help and tells no one who shouldn't be told. You " +
            "see a calm summary; the child sees care.",
        faqs: [
            {
                q: "What keeps it from just giving my kid the answers?",
                a:
                    "It's shaped to guide with questions and to stay within bounds you set as the parent. You " +
                    "choose which child is using it and which mode.",
            },
            {
                q: "What happens if my child types something worrying?",
                a:
                    "The system flags it, shows the child real crisis resources (verified, current, including " +
                    "lines for military families overseas), and emails you a careful summary. When a parent " +
                    "might be the source of the fear, it's built to protect the child first.",
            },
            {
                q: "Does it report us to anyone?",
                a:
                    "No. The family's information stays inside the family. The crisis help shown to a child " +
                    "notifies no one; it points to real, qualified human help.",
            },
        ],
    },
    {
        id: "discipleship",
        eyebrow: "Family discipleship",
        headline: "Discipleship that stays on the table.",
        body:
            "The year's plan always finds room for math. It rarely protects family worship. Quill & Compass " +
            "keeps the means of grace in the daily rhythm: Scripture memory with a real method, Bible reading " +
            "that traces the one story from promise to fulfillment in Christ (Luke 24:27), catechism in the " +
            "historic Reformed stream, a prayer journal, the unreached world to pray for, the neighbor down " +
            "the road to love. Matthew Henry sits alongside the text for the hard parts. The catechisms are " +
            "the ones the church has trusted: the Westminster Shorter and Larger, the Heidelberg, the 1689, " +
            "and more. None of it earns anything. It sets the table. The Lord feeds the children.",
        faqs: [
            {
                q: "Does the app replace church or family worship?",
                a:
                    "No. It keeps the structure so the Word stays daily. The discipling is the Lord's work " +
                    "through the Word, prayer, and the gathered church. The tool protects the time.",
            },
            {
                q: "Is the Bible teaching from a particular tradition?",
                a:
                    "Yes, and we're plain about it: Scripture read as one story fulfilled in Christ, in the " +
                    "Reformed confessional stream.",
            },
            {
                q: "My kids are young. Is any of this for them?",
                a:
                    "Yes. There's a children's catechism, a gospel-shaped guide to big emotions, and memory " +
                    "work that meets a younger child where they are.",
            },
        ],
    },
    {
        id: "records",
        eyebrow: "Planning & records",
        headline: "The records you dread, handled.",
        body:
            "Two fears run under a lot of homeschooling: the day-to-day (what are we even doing Tuesday?) " +
            "and the long game (will the records hold up when she applies to college?). The weekly planner " +
            "spreads a course across your real school days, skipping your holidays, so Tuesday plans itself. " +
            "For the high-school years, the transcript builder keeps courses, credits, and GPA in order and " +
            "prints clean. The paperwork stops being the thing you avoid.",
        faqs: [
            {
                q: "Can it build an actual high-school transcript?",
                a:
                    "Yes. Courses by year, credits, weighted or unweighted GPA on the scale you choose, ready " +
                    "to print as a PDF.",
            },
            {
                q: "Does scheduling understand our calendar?",
                a:
                    "Yes. Set your school days and holidays once. Distributing a course lays its lessons " +
                    "across the days you actually teach.",
            },
            {
                q: "What if I want my data out?",
                a: "Export everything you've put in as a single file, any time. It's yours.",
            },
        ],
    },
    {
        id: "calm",
        eyebrow: "Calm by design",
        headline: "Built to let you leave.",
        body:
            "Most software is built to pull you back in. This one is built to let you leave. No ads. No " +
            "tracking. No streaks, badges, or push notifications inventing urgency you don't need. Your data " +
            "is yours: take all of it with you whenever you want, and delete it for good. It's bootstrapped " +
            "by one person, funded by the families who use it, with no investors and no one in the attention " +
            "business holding a stake.",
        faqs: [
            {
                q: "How do you make money, then?",
                a:
                    "A simple subscription, once it's ready. You pay for the software and the software works " +
                    "for you. We'll never sell your data or run ads.",
            },
            {
                q: "Is it free right now?",
                a:
                    "It's free while it's in active development. Waitlist members hear first when the " +
                    "school-year plan opens.",
            },
            {
                q: "Who's behind it?",
                a:
                    `One builder, in the open, who got tired of tools that treat families as engagement to ` +
                    `harvest. You can email a real person: ${CONTACT_EMAIL}.`,
            },
        ],
    },
];

export const honesty = {
    heading: "Built in the open, by one person.",
    body:
        "I'd rather tell you the truth than sell you a finish line. Most of what's here works today: " +
        "generation, the library, the spine, the discipleship tools, the planner and transcripts, the " +
        `student tutor with its safety layer. A few corners are still being built, and the waitlist is how ` +
        `I bring families in as the ${SCHOOL_YEAR} version is readied. You'll hear from me when your spot ` +
        "opens. Once.",
};

export const finalCta = {
    heading: "Come build a calmer school year.",
    body:
        "Put your email in. I'll write once, when the school year opens. No spam, no selling your " +
        "address, no drip campaign.",
};

export const footer = {
    links: [
        { label: "About", href: "/about" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
    ],
    email: CONTACT_EMAIL,
    line: "Quill & Compass. Bootstrapped. No investors, no ads. Soli Deo Gloria.",
};
