import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Quill & Compass",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-qc-parchment p-4">
      <div className="w-full max-w-3xl space-y-8 py-12">
        <header className="text-center space-y-2">
          <h1 className="font-display text-4xl text-qc-charcoal">
            Privacy Policy
          </h1>
          <p className="font-body text-sm text-qc-text-muted">
            Effective Date: March 30, 2026 &middot; Last Updated: March 30, 2026
          </p>
        </header>

        {/* ── Plain-Language Summary (GOV-02: ≤500 words, ≤8th-grade reading level) ── */}
        <section className="rounded-qc-md border border-qc-primary/20 bg-qc-primary/5 p-6 space-y-4">
          <h2 className="font-display text-xl text-qc-charcoal">
            Privacy Summary — Plain Language
          </h2>
          <div className="qc-prose font-body text-qc-charcoal space-y-3 text-sm leading-relaxed">
            <p>
              <strong>What we collect:</strong> When you sign up with Google, we
              store your name, email, and profile picture. When you use the app,
              we store the content you create: students, courses, library
              resources, prayer journals, Bible memory verses, devotional
              reflections, church notes, gratitude entries, transcripts, and your
              family blueprint settings. We also store assessment results and
              course progress for your students.
            </p>
            <p>
              <strong>Why we collect it:</strong> We use your data to power the
              features you use. Student profiles, learning styles, and
              educational preferences are sent to Google Gemini AI so it can
              generate personalized curriculum content for your family. We do not
              use your data for advertising, profiling, or any purpose beyond
              running Quill &amp; Compass.
            </p>
            <p>
              <strong>Who can see it:</strong> Your data is private to your
              family&apos;s account. We share data with third-party services only
              to run the product (see the full list below). We never sell, rent,
              or give your data to advertisers or data brokers.
            </p>
            <p>
              <strong>How long we keep it:</strong> We keep your data for as long
              as your account is active. If you delete your account, we
              permanently destroy all your data within 30 days. Safety flags
              related to child protection are retained for up to 90 days after
              account deletion for legal compliance, then permanently destroyed.
            </p>
            <p>
              <strong>How to delete it:</strong> You can delete your account at
              any time from Account Settings &rarr; Data &amp; Privacy. Deletion
              is permanent and removes all your data, including students,
              courses, journals, and files. You can also export all your data as
              a JSON file before deleting.
            </p>
          </div>
        </section>

        {/* ── Full Privacy Policy ── */}
        <article className="qc-prose font-body text-qc-charcoal space-y-6 text-sm leading-relaxed">
          <h2 className="font-display text-2xl">1. Information We Collect</h2>
          <h3 className="font-display text-lg">1.1 Account Information</h3>
          <p>
            When you sign in with Google, we receive and store your name, email
            address, and profile image URL. We do not collect or store your
            Google password.
          </p>

          <h3 className="font-display text-lg">1.2 User-Generated Content</h3>
          <p>
            You create and store the following content within Quill &amp; Compass:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Student profiles (name, birthdate, grade, learning needs)</li>
            <li>Courses, course blocks, and activities</li>
            <li>Living Library resources (books, videos, articles, documents)</li>
            <li>Family discipleship content (prayer journals, Bible memory verses, devotional reflections, church notes, gratitude entries)</li>
            <li>Assessment results and grading data</li>
            <li>Transcripts and academic records</li>
            <li>Schedule and planner entries</li>
            <li>Family Blueprint configuration (educational philosophy, schedule, faith background)</li>
          </ul>

          <h3 className="font-display text-lg">1.3 AI-Related Data</h3>
          <p>
            When you generate curriculum content, we send the following context
            to Google Gemini AI: student first name, grade, age, learning
            difficulties, support needs, interests, personality traits, learning
            style preferences, your educational philosophy, and faith background.
            This data is used solely to personalize the generated content and is
            not stored by Google beyond the API request.
          </p>

          <h3 className="font-display text-lg">1.4 Safety Monitoring</h3>
          <p>
            When students use the Thinkling Chat feature, messages are
            automatically scanned for safety concerns (self-harm, bullying,
            grooming, violence). If a concern is detected, we store a safety
            flag containing the first 100 characters of the message, the
            category and severity of concern, and a recommended action. Full
            message content is not stored in safety records.
          </p>

          <h3 className="font-display text-lg">1.5 What We Do Not Collect</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>No analytics or usage tracking</li>
            <li>No device fingerprinting</li>
            <li>No location data</li>
            <li>No cookies beyond authentication</li>
            <li>No advertising identifiers</li>
          </ul>

          <h2 className="font-display text-2xl">2. How We Use Your Data</h2>
          <p>We use your data exclusively to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and operate the Quill &amp; Compass platform</li>
            <li>Generate personalized curriculum content via AI</li>
            <li>Monitor student safety in chat interactions</li>
            <li>Store and display your educational content and records</li>
          </ul>
          <p>
            We do not use your data for advertising, behavioral profiling,
            market research, or any purpose beyond the features you actively use.
          </p>

          <h2 className="font-display text-2xl">
            3. Third-Party Services
          </h2>
          <p>
            We use the following third-party services to operate Quill &amp; Compass. Each
            service receives only the data necessary for its function:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-qc-border-subtle">
                  <th className="py-2 pr-4 font-semibold">Service</th>
                  <th className="py-2 pr-4 font-semibold">Purpose</th>
                  <th className="py-2 font-semibold">Data Shared</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-qc-border-subtle/50">
                <tr>
                  <td className="py-2 pr-4">Google OAuth</td>
                  <td className="py-2 pr-4">Authentication</td>
                  <td className="py-2">Email, name, profile image</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Google Gemini AI</td>
                  <td className="py-2 pr-4">Curriculum generation</td>
                  <td className="py-2">
                    Student name, grade, age, learning profile, interests, faith
                    background, educational philosophy
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Firebase Storage</td>
                  <td className="py-2 pr-4">File storage</td>
                  <td className="py-2">Uploaded documents and book scans</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Inngest</td>
                  <td className="py-2 pr-4">Background processing</td>
                  <td className="py-2">
                    Event metadata for safety scans and document processing
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Joshua Project API</td>
                  <td className="py-2 pr-4">Missions data</td>
                  <td className="py-2">None (read-only public data)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">ESV Bible API</td>
                  <td className="py-2 pr-4">Scripture content</td>
                  <td className="py-2">None (read-only)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Google Books API</td>
                  <td className="py-2 pr-4">Book metadata lookup</td>
                  <td className="py-2">ISBN or search queries</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            We do not use any advertising networks, data brokers, analytics
            services, or tracking tools.
          </p>

          <h2 className="font-display text-2xl">4. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Active accounts:</strong> Data retained for the lifetime of
              your account.
            </li>
            <li>
              <strong>Deactivated accounts:</strong> Data retained but not
              processed. You may reactivate at any time.
            </li>
            <li>
              <strong>Deleted accounts:</strong> All data permanently destroyed
              within 30 days of deletion request.
            </li>
            <li>
              <strong>Safety flags:</strong> Retained up to 90 days after
              account deletion for child protection legal compliance, then
              permanently destroyed.
            </li>
            <li>
              <strong>Backups:</strong> Purged within 30 days of account
              deletion.
            </li>
          </ul>

          <h2 className="font-display text-2xl">5. Your Rights</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Export:</strong> Download all your data as a JSON file from
              Account Settings &rarr; Data &amp; Privacy.
            </li>
            <li>
              <strong>Delete:</strong> Permanently delete your account and all
              data from Account Settings &rarr; Data &amp; Privacy.
            </li>
            <li>
              <strong>Deactivate:</strong> Pause your account while keeping your
              data intact.
            </li>
            <li>
              <strong>Access:</strong> View all your data within the app at any
              time.
            </li>
          </ul>

          <h2 className="font-display text-2xl">6. Children&apos;s Privacy</h2>
          <p>
            Quill &amp; Compass is designed for use by parents and educators managing
            education for their children. Student accounts are created and
            managed by parents. We do not knowingly collect personal information
            directly from children under 13 without parental consent. All student
            data is entered and controlled by the parent account holder.
          </p>

          <h2 className="font-display text-2xl">7. Security</h2>
          <p>
            We protect your data using industry-standard measures: HTTPS/TLS for
            all data transmission, secure authentication via Google OAuth with
            PKCE, HTTP-only secure cookies, and database access restricted by
            authentication. Instructor PINs are hashed with bcrypt.
          </p>

          <h2 className="font-display text-2xl">8. Changes to This Policy</h2>
          <p>
            If we make material changes to this policy, we will notify you via
            email before the changes take effect. We will provide a clear summary
            of what changed. The effective date at the top of this page always
            reflects the latest version.
          </p>

          <h2 className="font-display text-2xl">9. Contact</h2>
          <p>
            For privacy questions or data requests, contact us at{" "}
            <a
              href="mailto:adam@quillandcompass.app"
              className="underline text-qc-primary hover:text-qc-primary/80"
            >
              adam@quillandcompass.app
            </a>
            .
          </p>
        </article>

        <footer className="text-center pt-8 border-t border-qc-border-subtle">
          <Link
            href="/"
            className="font-body text-sm text-qc-primary hover:underline"
          >
            &larr; Back to Quill &amp; Compass
          </Link>
        </footer>
      </div>
    </div>
  );
}
