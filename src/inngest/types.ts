import { EventSchemas } from "inngest";

type ProcessDocumentEvent = {
    data: {
        resourceId: string;
        fileUrl: string;
        fileType: string;
        organizationId: string; // carried for RLS tenant context in the background worker
    };
};

type ChatMessageSentEvent = {
    data: {
        studentId: string;
        message: string;
        organizationId: string; // carried for RLS tenant context in the background worker
    };
};

type CurriculumCompileEvent = {
    data: {
        specId: string;
        bundleId: string;
        organizationId: string;
        userId: string;
    };
};

type Events = {
    "resource/process.document": ProcessDocumentEvent;
    "chat/message.sent": ChatMessageSentEvent;
    "curriculum/compile": CurriculumCompileEvent;
};

export const schema = new EventSchemas().fromRecord<Events>();
