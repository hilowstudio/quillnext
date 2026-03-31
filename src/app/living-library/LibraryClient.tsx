"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookList } from "@/components/library/BookList";
import { VideoList } from "@/components/library/VideoList";
import { ArticleList } from "@/components/library/ArticleList";
import { DocumentList } from "@/components/library/DocumentList";
import { CourseList } from "@/components/library/CourseList";
import { ResourceList } from "@/components/library/ResourceList";
import { useSearchParams, useRouter } from "next/navigation";

interface LibraryClientProps {
    initialData: {
        books: any[];
        videos: any[];
        articles: any[];
        documents: any[];
        courses: any[];
        resources: any[];
        students: any[];
    };
    organizationId: string;
    userId: string;
}

export function LibraryClient({ initialData, organizationId, userId }: LibraryClientProps) {
    const [books, setBooks] = useState(initialData.books);
    const [videos, setVideos] = useState(initialData.videos);
    const [articles, setArticles] = useState(initialData.articles);
    const [documents, setDocuments] = useState(initialData.documents);
    const [courses, setCourses] = useState(initialData.courses);
    // Resources are managed via URL params, so we might not need state, but for consistency if we want client updates...
    // Actually ResourceList manages its own validaiton via URL, so we can pass initialData.resources directly.

    const searchParams = useSearchParams();
    const router = useRouter();
    const currentTab = searchParams.get("tab") || "books";

    const onTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", value);
        router.push(`/living-library?${params.toString()}`);
    };

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
                Living Library
            </h1>
            <p className="font-body text-qc-text-muted mb-8 qc-prose">
                Your collection of books, videos, articles, documents, and generated resources.
            </p>

            <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="mb-8">
                    <TabsTrigger value="books">Books</TabsTrigger>
                    <TabsTrigger value="videos">Videos</TabsTrigger>
                    <TabsTrigger value="articles">Articles</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="courses">Courses</TabsTrigger>
                    <TabsTrigger value="resources">Resources</TabsTrigger>
                </TabsList>

                <TabsContent value="books">
                    <BookList books={books} refreshBooks={() => { }} organizationId={organizationId} />
                </TabsContent>
                <TabsContent value="videos">
                    <VideoList videos={videos} setVideos={setVideos} />
                </TabsContent>
                <TabsContent value="articles">
                    <ArticleList articles={articles} setArticles={setArticles} organizationId={organizationId} userId={userId} />
                </TabsContent>
                <TabsContent value="documents">
                    <DocumentList documents={documents} setDocuments={setDocuments} organizationId={organizationId} userId={userId} />
                </TabsContent>
                <TabsContent value="courses">
                    <CourseList courses={courses} />
                </TabsContent>
                <TabsContent value="resources">
                    <ResourceList
                        resources={initialData.resources}
                        students={initialData.students}
                        courses={initialData.courses}
                        books={initialData.books}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
