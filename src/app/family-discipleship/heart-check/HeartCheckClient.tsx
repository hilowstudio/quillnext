'use client';

import React, { useState, memo, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Check, Cross } from '@phosphor-icons/react/dist/ssr';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';


import {
    Droplet,
    Bomb,
    Ghost,
    BandAid,
    Unlink,
    Mask,
    Badge,
    Spa
} from '@emotion-icons/boxicons-regular';

interface EmotionContent {
    description: string;
    godsDesign: string[];
    theNeed: string[];
    theWarning: {
        impairment: string;
        sin: string;
    };
    theGospel: string[];
    introspectionQuestions: string[];
    prayerPrompts: string[];
    relatedVerses?: string[];
    relationalSteps?: string[];
}

interface Emotion {
    id: string;
    name: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: string | number }>;
    subtitle: string;
    helpingWords: string[];
    content: EmotionContent;
}

// Emotion data with helping words and full content
const emotions: Emotion[] = [
    {
        id: 'sadness',
        name: 'Sadness',
        icon: Droplet,
        subtitle: 'The emotion of loss',
        helpingWords: [
            'Disappointed', 'Grieving', 'Down', 'Discouraged',
            'Heartbroken', 'Heavy', '"Bummed out"', 'Mourning'
        ],
        content: {
            description: 'Sadness is the emotion of **loss**. It\'s the heart\'s natural, God-given response when we lose something or someone valuable. It shows that you *care*.',
            godsDesign: [
                'Sadness is not a sign of weak faith; it\'s a sign of a tender heart.',
                'Jesus was called a "man of sorrows, and acquainted with grief" (Isaiah 53:3).',
                'When his friend Lazarus died, "Jesus wept" (John 11:35). He didn\'t bypass grief; He entered into it.'
            ],
            theNeed: [
                'Sadness tells you that you are missing something or someone. It could be the loss of a person, a dream, a hope, or even just the loss of a good day.',
                'Your heart is communicating a deep need for **comfort**, **hope**, and **presence**.'
            ],
            theWarning: {
                impairment: 'We pull away from others, believing no one can understand.',
                sin: 'We can fall into *despair*—the belief that things will never get better and God is not good. We may also try to *numb* our sadness with idols (screens, food, shopping, busyness) instead of bringing our pain to the Healer.'
            },
            theGospel: [
                'Jesus is the "God of all comfort" (2 Corinthians 1:3).',
                'He entered our broken world and experienced the ultimate sadness and loss—separation from the Father on the cross—so that we would *never* have to be truly alone in our grief.',
                'He meets your need for **presence** by giving you His Spirit. He meets your need for **hope** by promising to one day "wipe away every tear from [your] eyes" (Revelation 21:4). Your sadness is real, but it is not the end of the story.'
            ],
            introspectionQuestions: [
                'What am I feeling sad about? What is the loss I\'m grieving?',
                'Have I been pulling away from God or others in my sadness?',
                'Have I tried to numb or ignore this feeling instead of trusting God with it? I confess this now.'
            ],
            prayerPrompts: [
                '"Lord, thank you for giving me a heart that cares. Thank you that you see my sadness."',
                '"Jesus, \'Man of Sorrows,\' thank you for being with me in this. Please be my comfort right now."',
                '"Father, help me to trust your promise that \'weeping may tarry for the night, but joy comes with the morning\' (Psalm 30:5). Please don\'t let me get stuck here."'
            ],
            relationalSteps: [
                'Find a parent, spouse, or friend and simply say, "I\'m feeling really sad right now. Can I just tell you about it?" You don\'t need them to fix it, just to *be with* you in it.',
                'It\'s okay to cry. Crying is a God-given way to release the pain of loss.',
                'Put on music that is both honest about sorrow and true about God\'s hope (like many of the Psalms or modern hymns).'
            ]
        }
    },
    {
        id: 'anger',
        name: 'Anger',
        icon: Bomb,
        subtitle: 'The emotion of injustice',
        helpingWords: [
            'Frustrated', 'Mad', 'Annoyed', 'Irritated',
            'Upset', 'Resentful', 'Bitter', '"Fed up"'
        ],
        content: {
            description: 'Anger is the powerful emotion God gives us to move against what is **wrong**. It\'s the energy that says, "This shouldn\'t be!"',
            godsDesign: [
                'God himself expresses righteous anger against sin, injustice, and anything that harms what He loves.',
                'Jesus felt anger. He looked at the hard-hearted religious leaders "in anger, grieved at their hardness of heart" (Mark 3:5).',
                'The Bible doesn\'t say "Don\'t be angry." It says, "Be angry and do not sin" (Ephesians 4:26). Your anger itself isn\'t the problem; it\'s a diagnostic tool.'
            ],
            theNeed: [
                'Anger almost always points to a need for **justice** or **righteousness**.',
                'It\'s a sign that a boundary has been crossed, an injustice has occurred, or something or someone you value feels threatened. Your heart is crying out for things to be made *right*.'
            ],
            theWarning: {
                impairment: 'We might turn our anger inward, letting it become bitterness, resentment, or depression.',
                sin: 'We might turn our anger outward, using harsh words, manipulation, or even physical force to get our way. We try to become our own judge, jury, and executioner.'
            },
            theGospel: [
                'The Gospel is the only true answer to our anger.',
                '1. **Jesus absorbed God\'s justice:** On the cross, Jesus took the full, righteous anger of God against *our* sin.',
                '2. **Jesus understands your injustice:** He was perfectly innocent, yet He was betrayed, falsely accused, and murdered. He understands being wronged.',
                'Because of the cross, you are free. You don\'t have to carry the burden of being your own judge. You can trust the only *good* Judge, who will one day make all things right. He meets your need for justice.'
            ],
            introspectionQuestions: [
                'What injustice am I feeling? What feels "wrong" to me right now?',
                'Is my anger about God\'s honor and what is truly wrong, or is it more about my own comfort, preferences, or control?',
                'Have I sinned in my anger? (Harsh words, unkind thoughts, slamming doors, giving the silent treatment?) I confess this now.'
            ],
            prayerPrompts: [
                '"Lord, thank you for the gift of anger that shows me something is wrong. Help me to be angry about what angers You."',
                '"Father, reveal any bitterness or selfish pride in my heart. Help me to forgive others as You have forgiven me."',
                '"Holy Spirit, please give me patience and wisdom. Show me if I need to speak up, and if so, give me the right words. Help me trust Your justice."'
            ],
            relationalSteps: [
                'Talk to a parent, spouse, or trusted friend about what made you angry.',
                'If you sinned, go to the person you harmed and seek forgiveness.',
                'Take a "pause" (count to 10, take 5 deep breaths) before responding the next time you feel this anger rise up.'
            ]
        }
    },
    {
        id: 'fear',
        name: 'Fear',
        icon: Ghost,
        subtitle: 'The emotion of threat',
        helpingWords: [
            'Afraid', 'Anxious', 'Worried', 'Scared',
            'Nervous', 'Terrified', 'Stressed', 'Overwhelmed'
        ],
        content: {
            description: 'Fear is the emotion of **threat**. It\'s the God-given alarm system that activates when you perceive danger—whether that danger is to your body, your emotions, or your future.',
            godsDesign: [
                'Fear is a normal, created response. It\'s what keeps you from stepping in front of a bus.',
                'The Bible is filled with faithful people who felt fear (David, Elijah, the disciples).',
                'Jesus Himself, in the garden, was "sorrowful and troubled" and in "agony," knowing the pain that was coming (Matthew 26:37-38; Luke 22:44).',
                'Feeling fear doesn\'t mean you lack faith. It means you are human and you know you are not in control.'
            ],
            theNeed: [
                'Fear points to a profound need for **safety**, **protection**, and **trust**.',
                'Your heart is crying out, "I am in danger and I am not safe! I need someone bigger and stronger than this threat to protect me."'
            ],
            theWarning: {
                impairment: 'We become *anxious* and paralyzed. We get "stuck" in "what if" scenarios, unable to move or make decisions. We avoid anything that feels risky.',
                sin: 'We try to become our *own* god to manage our fear. We try to control people, situations, and our future. This can look like manipulation, lashing out in "self-defense," or hoarding money or possessions to try to build our own security.'
            },
            theGospel: [
                'The Gospel is the ultimate answer to our deepest fears. Jesus defeated our greatest enemies: sin and death.',
                'He meets your need for **protection** by promising that *nothing* can separate you from His love (Romans 8:38-39). Even if the worst happens, you are eternally secure in Him.',
                'He meets your need for **trust** by being the *only* one who is truly in control and truly good.',
                'The Bible\'s most common command is "Do not be afraid," and it\'s always followed by a reason: "for I am with you" (Isaiah 41:10). Your safety isn\'t in the *absence* of threats, but in the *presence* of your Protector.'
            ],
            introspectionQuestions: [
                'What am I afraid of right now? What is the "threat" I am feeling?',
                'Have I been "stuck" in anxiety, replaying my fears over and over?',
                'Have I been trying to control people or situations to make myself feel safe? Have I been trusting my own plans more than God\'s goodness? I confess this now.'
            ],
            prayerPrompts: [
                '"Lord, I admit that I am scared. Thank you for inviting me to \'cast all my anxieties on you, because you care for me\' (1 Peter 5:7)."',
                '"Jesus, you are my Good Shepherd. Even when I walk through the darkest valley, help me to fear no evil, for you are with me (Psalm 23:4)."',
                '"Father, I don\'t know what will happen, but I know you are good. Help me to trust You with this, just for today."'
            ],
            relationalSteps: [
                '*Name* your fear to a safe person. Saying it out loud robs it of its power.',
                'Read a Psalm of comfort (like Psalm 23, 46, or 91).',
                'Do the *next right thing*. Fear paralyzes, but faith *acts*. You don\'t have to solve the whole problem, just take the next small, faithful step.'
            ]
        }
    },
    {
        id: 'hurt',
        name: 'Hurt',
        icon: BandAid,
        subtitle: 'The emotion of relational injury',
        helpingWords: [
            'Wounded', 'Pained', 'Crushed', 'Rejected',
            'Betrayed', '"Stung"', 'Offended', 'Slighted'
        ],
        content: {
            description: 'Hurt is the emotion of **injury**. It\'s the "Ouch!" of the soul, telling you that you have been wounded by someone\'s words or actions. It signals that a relationship that matters to you is broken or in pain.',
            godsDesign: [
                'God\'s heart can be hurt. The Bible says He was "grieved" and "hurt to the heart" by mankind\'s sin (Genesis 6:6).',
                'Jesus was hurt. He was "despised and rejected by men" (Isaiah 53:3) and betrayed by His closest friends.',
                'Feeling hurt doesn\'t mean you are weak; it means you are *relational* and *open*, just as God designed you to be.'
            ],
            theNeed: [
                'Hurt points to a deep need for **healing**, **validation** ("Your pain matters"), and **restoration** of the relationship.',
                'Your heart is saying, "What you did wounded me, and I need this connection to be made safe and whole again."'
            ],
            theWarning: {
                impairment: 'We build walls around our hearts and become cynical, calloused, or cold, vowing to never let anyone get close enough to hurt us again.',
                sin: 'We hold a grudge and let our hurt turn into bitterness, resentment, or a desire for revenge. We "hurt them back" with our words, actions, or by withholding love.'
            },
            theGospel: [
                'Jesus is the "Wounded Healer." The wounds He took on the cross were not just for our sin, but for our *sorrows* (Isaiah 53:4).',
                'He knows the pain of being wounded by those He loved. He meets your need for **validation** because He sees your pain perfectly.',
                'He meets your need for **healing** because "by his wounds you have been healed" (1 Peter 2:24). He absorbed the ultimate wound so your wounds could be mended.',
                'He frees you from the need to get revenge. Because He has forgiven your immeasurable debt, He gives you the supernatural power to forgive those who have hurt you.'
            ],
            introspectionQuestions: [
                'Who or what hurt me? What words or actions felt like a wound?',
                'Have I been replaying the hurt over and over in my mind, letting it turn into bitterness?',
                'Have I tried to "hurt them back" or built a wall against them? Have I refused to forgive? I confess this now.'
            ],
            prayerPrompts: [
                '"Lord Jesus, you were wounded for me. Thank you for understanding my hurt."',
                '"Father, this really stings. Please be my healer. \'Heal me, O Lord, and I shall be healed\' (Jeremiah 17:14)."',
                '"Holy Spirit, give me the grace to forgive as I have been forgiven. If I need to have a hard conversation, please give me the wisdom and courage to do it gently."'
            ],
            relationalSteps: [
                'Talk to a parent, spouse, or trusted friend about your hurt. Let them "be with you" in it.',
                'Write down (even if you never send it) a letter to the person who hurt you, explaining what they did and how it made you feel.',
                'If it is safe and wise, consider speaking to the person who hurt you. Use "I" statements: "When you said ____, I felt ____."'
            ]
        }
    },
    {
        id: 'loneliness',
        name: 'Loneliness',
        icon: Unlink,
        subtitle: 'The emotion of disconnection',
        helpingWords: [
            'Lonely', 'Isolated', 'Disconnected', '"Left out"',
            'Abandoned', 'Unseen', 'Empty', 'Alone'
        ],
        content: {
            description: 'Loneliness is the emotion of **disconnection**. It\'s the ache you feel when you lack the meaningful connection with God and others that you were created for.',
            godsDesign: [
                'You were designed for community. In the very beginning, God said, "It is *not good* for the man to be alone" (Genesis 2:18).',
                'Jesus experienced deep loneliness. In the garden, His closest friends fell asleep on Him (Matthew 26:40). On the cross, He cried out, "My God, my God, why have you forsaken me?" (Matthew 27:46).',
                'Feeling lonely is not a sin; it\'s a signal that you are missing the vital connection you are wired for.'
            ],
            theNeed: [
                'Loneliness is a powerful cry for **belonging**, **intimacy**, and **presence**.',
                'Your heart is saying, "I need to be seen, known, and connected to someone who truly cares."'
            ],
            theWarning: {
                impairment: 'We believe the lie that no one *wants* to be with us, so we isolate ourselves even more, making the loneliness worse.',
                sin: 'We grasp for *counterfeit intimacy*. This can look like seeking attention in unhealthy ways, becoming too dependent on one person (idolatry), or turning to things like social media, fantasy, or pornography to *feel* connected without the risk of real relationship.'
            },
            theGospel: [
                'Jesus experienced the ultimate loneliness—separation from the Father—so that you would *never* be truly alone again.',
                'He meets your need for **presence** by giving you the Holy Spirit, the "Comforter," who lives in you.',
                'He meets your need for **belonging** by adopting you into His family, the Church (Ephesians 2:19). You are part of a body, connected to millions of brothers and sisters in Christ.',
                'His promise is not that you\'ll *never feel* lonely, but that you are *never alone*: "I am with you always, to the end of the age" (Matthew 28:20).'
            ],
            introspectionQuestions: [
                'When do I feel most lonely? What makes me feel disconnected?',
                'Have I been pulling away from people who care about me?',
                'Have I been turning to counterfeit "fixes" (like endless scrolling, video games, or fantasy) to numb my loneliness? I confess this now.'
            ],
            prayerPrompts: [
                '"Lord, thank you for making me for relationship. It hurts to feel disconnected."',
                '"Jesus, thank you for promising to never leave me. Help me to *feel* your presence with me right now."',
                '"Holy Spirit, please give me the courage to \'move toward\' someone today. Show me who needs a friend, and help me to be one."'
            ],
            relationalSteps: [
                'Reach out to one person. Send a text, make a call, or ask someone a question about their day.',
                'Join a group where you can find healthy community (a church small group, a club, a team).',
                'Practice "being with" God. Put your phone away for 10 minutes, go for a walk, and just talk to Him.'
            ]
        }
    },
    {
        id: 'shame',
        name: 'Shame',
        icon: Mask,
        subtitle: 'The emotion of unworthiness',
        helpingWords: [
            'Worthless', 'Inadequate', '"Not good enough"', 'Embarrassed',
            'Humiliated', 'Small', 'Exposed', 'Defective'
        ],
        content: {
            description: 'Shame is the intensely painful emotion of **exposure** and **unworthiness**. It\'s not just "I *did* something bad," but "I *am* something bad." It\'s the desperate feeling of wanting to hide.',
            godsDesign: [
                'Shame was the first human emotion after the Fall. Adam and Eve "knew that they were naked... and they hid themselves" (Genesis 3:7-8).',
                'Shame is a *consequence* of sin, designed to show us how far we\'ve fallen from God\'s glory and how desperately we need a "covering."',
                'Jesus experienced our shame. "He endured the cross, *despising its shame*" (Hebrews 12:2). He was stripped naked, mocked, and exposed to the world *for us*.'
            ],
            theNeed: [
                'Shame reveals our deepest need to be **covered**, **accepted**, **cleansed**, and **loved unconditionally**.',
                'Your heart is crying, "I am flawed and exposed. Will anyone still love me? I need to be made *worthy*."'
            ],
            theWarning: {
                impairment: 'We hide. We wear masks, pretending to be someone we\'re not. We become perfectionists, trying to *prove* we are worthy. We isolate ourselves, sure that if anyone *really* knew us, they would reject us.',
                sin: 'We can "lean into" our shame, defiantly living out the identity of "I\'m just a bad person, so what?" Or, we can attack others who make us feel small, trying to put *them* down to make ourselves feel better.'
            },
            theGospel: [
                'The Gospel is the *only* antidote to shame.',
                'Jesus meets your need to be **covered**. When Adam and Eve hid, God covered them with skins (Genesis 3:21). On the cross, Jesus was stripped so you could be "clothed... with Christ" (Galatians 3:27).',
                'He meets your need to be **accepted**. He "despised the shame" *for you*, so you could be presented to the Father "without blemish and free from accusation" (Colossians 1:22).',
                'In Christ, your identity is not "shameful." Your identity is "Beloved Child of God." He took your shame so you could have His righteousness.'
            ],
            introspectionQuestions: [
                'What triggered this feeling of shame? What am I believing about myself right now?',
                'Am I hiding? What "masks" am I wearing?',
                'Have I been listening to the Accuser\'s lies about my worth instead of God\'s truth about my identity in Christ? I confess this now.'
            ],
            prayerPrompts: [
                '"Lord, I feel so exposed and unworthy. Thank you that you \'despised the shame\' for me."',
                '"Father, please help me to believe what You say about me. Help me to hear Your voice of love over the voice of the Accuser."',
                '"Jesus, thank you for clothing me in your righteousness. \'There is now no condemnation for those who are in Christ Jesus\' (Romans 8:1). Help me live in that freedom."'
            ],
            relationalSteps: [
                'Practice confession. Find *one* safe, mature Christian (a parent, pastor, or friend) and bring your sin or shame into the light with them. Shame *dies* in the light of grace.',
                'Read Romans 8 or Ephesians 1 and write down every truth about who you are *in Christ*.',
                'Serve someone else. Shame makes us turn inward. Serving others reminds us of our purpose and God\'s power in us.'
            ]
        }
    },
    {
        id: 'guilt',
        name: 'Guilt',
        icon: Badge,
        subtitle: 'The emotion of transgression',
        helpingWords: [
            '"In the wrong"', 'Regretful', 'Remorseful', 'Sorry',
            '"Ashamed of what I did"', 'Convicted', 'Culpable'
        ],
        content: {
            description: 'Guilt is the emotion of **transgression**. It is the internal alarm God gives you when you have crossed a real standard—God\'s law. Unlike shame (I *am* bad), guilt says, "I *did* something bad."',
            godsDesign: [
                'Guilt is a *gift*. It\'s a "godly grief" that "produces a repentance that leads to salvation" (2 Corinthians 7:10). It\'s the healthy, painful signal that a *real sin* has occurred and needs to be dealt with.',
                'King David felt intense guilt after his sin: "My sin is ever before me. Against you, you only, have I sinned" (Psalm 51:3-4).',
                'This feeling is meant to *move you toward* God, not away from Him.'
            ],
            theNeed: [
                'Guilt points to a clear and desperate need for **forgiveness**, **pardon**, and **cleansing**.',
                'Your heart is crying out, "I have done wrong, and I need to be made right with God and the person I wronged."'
            ],
            theWarning: {
                impairment: 'We can get stuck in "ungodly sorrow" (2 Corinthians 7:10), which just leads to *death*. We try to punish ourselves, wallow in self-pity, or try to "make up for it" with good works, never feeling truly clean.',
                sin: 'Like Adam, we blame someone else ("The woman you gave me..."). Or like Cain, we get angry and defiant. We hide, justify, or minimize our sin instead of confessing it.'
            },
            theGospel: [
                'The Gospel is the *only* answer to true guilt. You cannot "make up for" your sin.',
                'Jesus meets your need for **forgiveness** by being your substitute. He, the only innocent one, took your *guilt* upon Himself on the cross. The "gavel" of God\'s justice came down on *Him* instead of you.',
                'He meets your need for **cleansing** by paying your debt in full. His blood "cleanses us from all sin" (1 John 1:7).',
                'Because of Jesus, when you confess, God is "faithful and just to forgive us our sins and to cleanse us from all unrighteousness" (1 John 1:9). Your guilt is *gone*.'
            ],
            introspectionQuestions: [
                'What specific action or thought is making me feel guilty? What standard (God\'s, my own?) did I violate?',
                'Have I confessed this sin specifically to God? (1 John 1:9)',
                'Do I need to confess this to and seek forgiveness from another person? (James 5:16)',
                'Am I wallowing in this guilt, or am I accepting God\'s free gift of forgiveness?'
            ],
            prayerPrompts: [
                '"Father, I have sinned against You. [Name the sin specifically.] I am truly sorry."',
                '"Thank you, Jesus, for paying the price for this sin. I receive your forgiveness right now."',
                '"Holy Spirit, please help me to \'go and sin no more.\' Give me the strength to turn from this and walk in Your way."'
            ],
            relationalSteps: [
                '**Confess:** If you have sinned against God, confess to Him. If you have sinned against a person, go to them, name your sin (without excuses), and ask, "Will you please forgive me?"',
                '**Repent:** To "repent" means to *turn around*. Take one practical step to turn *away* from that sin and *toward* righteousness.',
                '**Receive:** When God says you are forgiven, *believe Him*. Don\'t pick that guilt back up. It\'s been paid for.'
            ]
        }
    },
    {
        id: 'gladness',
        name: 'Gladness',
        icon: Spa,
        subtitle: 'The emotion of well-being',
        helpingWords: [
            'Happy', 'Joyful', 'Thankful', 'Grateful',
            'Pleased', 'Content', 'Peaceful', 'Excited', 'Relieved'
        ],
        content: {
            description: 'Gladness (or joy) is the emotion of **delight** and **well-being**. It is the heart\'s response to receiving something *good*—a gift, a relationship, a beautiful moment, or a truth.',
            godsDesign: [
                'God is a joyful God! He "rejoices over you with singing" (Zephaniah 3:17). The purpose of creation is His good pleasure (Revelation 4:11).',
                'Joy is a "fruit of the Spirit" (Galatians 5:22).',
                'Jesus said He came so that "my joy may be in you, and that your joy may be full" (John 15:11).',
                'Gladness is not a "bonus"; it is central to the Christian life. We are commanded to "Rejoice in the Lord always!" (Philippians 4:4).'
            ],
            theNeed: [
                'Gladness is both a *response* to a good gift and the *expression* of a core need.',
                'It expresses your heart\'s need and capacity for **celebration**, **gratitude**, and **worship**.',
                'Your heart is saying, "This is good! This is right! This is a gift to be enjoyed and thankful for!"'
            ],
            theWarning: {
                impairment: 'We can feel "guilty" for being happy, especially when others are suffering. Or we "numb" our joy, afraid to feel it fully because we fear it will be taken away.',
                sin: 'This is the biggest danger. We take the *good gift* that makes us glad (a person, success, a possession) and we make it the *ultimate thing*. We worship the *creation* rather than the *Creator* (Romans 1:25). We seek our joy *in* the gift, rather than *in* the Giver.'
            },
            theGospel: [
                'The Gospel is the "good news of *great joy* for all the people" (Luke 2:10).',
                'Jesus is the source of all good gifts. Every moment of gladness is a small echo of the ultimate joy found in Him.',
                'He frees you to *fully enjoy* good gifts (like a sunset, a good meal, or a friendship) because you no longer need them to be your *god*. You can love them as *gifts* because your ultimate hope is secure in the *Giver*.',
                'Your need for joy is ultimately met in relationship with Him—in His presence is the "fullness of joy" (Psalm 16:11).'
            ],
            introspectionQuestions: [
                'What is making me feel glad right now? What is the *good gift* I am enjoying?',
                'Have I paused to thank God for this gift?',
                'Is any part of my heart loving this *gift* more than God, the *Giver*? Have I made it an idol? I confess this now.'
            ],
            prayerPrompts: [
                '"Father, thank you! Thank you for this [name the specific gift]. You are so good to me."',
                '"\'Every good and perfect gift is from above\' (James 1:17). Help me to enjoy this gift with a heart full of gratitude *to You*."',
                '"Lord, help me to find my deepest, most lasting joy in You, not just in Your gifts. You are the treasure."'
            ],
            relationalSteps: [
                '**Share your joy!** Tell someone in your family or a friend what you are thankful for. Joy is meant to be shared.',
                '**Thank someone.** If your joy is because of a person, *tell them* and thank them.',
                '**Worship.** Turn your gladness into worship. Put on a joyful song, write down three things you\'re thankful for, or simply say, "God, you are good!"'
            ]
        }
    }
];

interface EmotionCardProps {
    emotion: Emotion;
    index: number;
    onSelect: (emotion: Emotion) => void;
}

const EmotionCard = memo<EmotionCardProps>(({ emotion, index, onSelect }) => {
    // Tailwind colors aren't directly available as classes unless they're safe-listed or used as arbitrary values if dynamic.
    // For simplicity, we'll use specific background colors that match the "vibe" or standard palette.
    // The reference used specific color names: compass-gold, table-wine, inkwell, midnight.


    // Split words into 4 rows
    const wordsPerRow = Math.ceil(emotion.helpingWords.length / 4);
    const wordRows = [];
    for (let i = 0; i < 4; i++) {
        const start = i * wordsPerRow;
        const end = Math.min(start + wordsPerRow, emotion.helpingWords.length);
        wordRows.push(emotion.helpingWords.slice(start, end));
    }

    return (
        <button
            onClick={() => onSelect(emotion)}
            className="p-4 md:p-6 rounded-xl bg-gradient-to-br from-white to-qc-parchment text-qc-charcoal border border-qc-border-subtle shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-[1.02] text-center touch-manipulation min-h-[44px] w-full flex flex-col items-center justify-between h-full group"
        >
            <div>
                <div className="text-3xl md:text-4xl mb-2 md:mb-3 text-qc-primary flex justify-center">
                    <emotion.icon size={48} />
                </div>
                <h3 className="text-base md:text-lg lg:text-xl font-bold mb-1 md:mb-2 text-qc-primary">{emotion.name}</h3>
                <p className="text-xs md:text-sm text-qc-text-muted mb-2 md:mb-3 italic">{emotion.subtitle}</p>
            </div>
            <div className="flex flex-col gap-2 mt-auto w-full">
                {wordRows.map((rowWords, rowIdx) => (
                    <div key={rowIdx} className="flex flex-wrap gap-1 justify-center">
                        {rowWords.map((word, wordIdx) => (
                            <span key={wordIdx} className="text-[10px] bg-qc-surface-raised text-qc-text-muted px-1.5 py-0.5 rounded leading-tight">
                                {word}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </button>
    );
});
EmotionCard.displayName = 'EmotionCard';

export default function HeartCheckClient() {
    const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
    // Render Selection View
    if (!selectedEmotion) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 py-6">




                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {emotions.map((emotion, index) => (
                        <EmotionCard
                            key={emotion.id}
                            emotion={emotion}
                            index={index}
                            onSelect={setSelectedEmotion}
                        />
                    ))}
                </div>


            </div>
        );
    }

    // Render Detail View
    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-6">
            <Button variant="ghost" className="mb-6 flex items-center gap-2" onClick={() => setSelectedEmotion(null)}>
                ← Back to Emotions
            </Button>

            <div className="bg-white rounded-qc-lg shadow-lg border border-qc-border-subtle overflow-hidden">
                <div className="p-8 bg-gradient-to-br from-white to-qc-parchment border-b border-qc-border-subtle text-qc-charcoal">
                    <div className="flex items-center gap-4">
                        <span className="text-qc-primary">
                            <selectedEmotion.icon size={64} />
                        </span>
                        <div>
                            <h1 className="text-4xl font-bold font-display text-qc-primary text-balance">{selectedEmotion.name}</h1>
                            <p className="text-xl text-qc-text-muted italic">{selectedEmotion.subtitle}</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8 font-body text-qc-charcoal">
                    <section>
                        <h3 className="text-xl font-bold text-qc-primary mb-3 font-display text-balance">What is this feeling?</h3>
                        <div className="prose prose-lg text-qc-charcoal max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {selectedEmotion.content.description}
                            </ReactMarkdown>
                        </div>
                    </section>

                    <div className="grid md:grid-cols-2 gap-8">
                        <section className="bg-qc-success-bg p-6 rounded-lg border border-qc-success-border">
                            <h3 className="font-bold text-qc-success-text mb-3 flex items-center gap-2">
                                <Check className="w-5 h-5" /> God&apos;s Design
                            </h3>
                            <ul className="space-y-2 text-sm">
                                {selectedEmotion.content.godsDesign.map((item, i) => (
                                    <li key={i} className="flex gap-2 items-start">
                                        <span className="mt-1">•</span>
                                        <div className="prose prose-sm text-qc-success-text max-w-none">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                                components={{ p: ({ node, ...props }) => <span {...props} /> }}
                                            >
                                                {item}
                                            </ReactMarkdown>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="bg-qc-info-bg p-6 rounded-lg border border-qc-info-border">
                            <h3 className="font-bold text-qc-info-text mb-3">The Need</h3>
                            <ul className="space-y-2 text-sm">
                                {selectedEmotion.content.theNeed.map((item, i) => (
                                    <li key={i} className="flex gap-2 items-start">
                                        <span className="mt-1">•</span>
                                        <div className="prose prose-sm text-qc-info-text max-w-none">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                                components={{ p: ({ node, ...props }) => <span {...props} /> }}
                                            >
                                                {item}
                                            </ReactMarkdown>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    <section className="bg-qc-error-bg p-6 rounded-lg border border-qc-error-border">
                        <h3 className="font-bold text-qc-error mb-3">The Warning</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <strong className="block text-qc-error mb-1">Impairment:</strong>
                                <div className="prose prose-sm text-qc-error max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                        {selectedEmotion.content.theWarning.impairment}
                                    </ReactMarkdown>
                                </div>
                            </div>
                            <div>
                                <strong className="block text-qc-error mb-1">Sin:</strong>
                                <div className="prose prose-sm text-qc-error max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                        {selectedEmotion.content.theWarning.sin}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-qc-parchment/30 p-6 rounded-lg border border-qc-border-subtle">
                        <h3 className="text-xl font-bold text-qc-primary mb-4 font-display text-balance">The Gospel Answer</h3>
                        <ul className="space-y-3">
                            {selectedEmotion.content.theGospel.map((item, i) => (
                                <li key={i} className="flex gap-3 items-start">
                                    <div className="bg-qc-parchment p-1 rounded-full mt-0.5 shrink-0 text-qc-primary">
                                        <Cross weight="fill" className="w-4 h-4" />
                                    </div>
                                    <div className="prose prose-stone max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                            components={{ p: ({ node, ...props }) => <span {...props} /> }}
                                        >
                                            {item}
                                        </ReactMarkdown>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold text-qc-primary mb-4 font-display text-balance">Introspection Questions</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            {selectedEmotion.content.introspectionQuestions.map((q, i) => (
                                <li key={i}>
                                    <div className="prose prose-stone max-w-none inline">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                            components={{ p: ({ node, ...props }) => <span {...props} /> }}
                                        >
                                            {q}
                                        </ReactMarkdown>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold text-qc-primary mb-4 font-display text-balance">Prayer Prompts</h3>
                        <ul className="space-y-3">
                            {selectedEmotion.content.prayerPrompts.map((p, i) => (
                                <li key={i} className="bg-qc-parchment/50 p-3 rounded-lg border border-qc-border-subtle italic text-qc-charcoal relative">
                                    <span className="absolute left-2 top-2 text-2xl text-qc-primary opacity-20">&quot;</span>
                                    <div className="pl-4 prose prose-stone max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                            components={{ p: ({ node, ...props }) => <span {...props} /> }}
                                        >
                                            {p.replace(/^"|"$/g, '')}
                                        </ReactMarkdown>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold text-qc-primary mb-4 font-display text-balance">Relational Steps</h3>
                        <ul className="list-decimal pl-5 space-y-2">
                            {selectedEmotion.content.relationalSteps?.map((s, i) => (
                                <li key={i}>
                                    <div className="prose prose-stone max-w-none inline">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                            components={{ p: ({ node, ...props }) => <span {...props} /> }}
                                        >
                                            {s}
                                        </ReactMarkdown>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
