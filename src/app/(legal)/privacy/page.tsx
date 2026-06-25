import type { Metadata } from "next";

import { A, H1, H2, P, UL, Updated } from "@/components/legal/legal-ui";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="legal">
      <H1>Privacy Policy</H1>
      <Updated>Last updated: June 25, 2026. Effective: June 25, 2026.</Updated>

      <P>
        This Privacy Policy explains how Qualia (&quot;we&quot;, &quot;us&quot;)
        collects, uses, and shares information when you use the Qualia
        application (the &quot;Service&quot;). If you have questions, contact us
        at qualiaaiteam@gmail.com.
      </P>

      <H2>1. Who can use Qualia</H2>
      <P>
        Qualia is intended for users aged 13 and older. If you are under 16 and
        in the European Economic Area or the United Kingdom, you may need a
        parent or guardian&apos;s consent for us to process your personal data,
        as required by local law. We do not knowingly collect personal data from
        children under 13. If you believe a child under 13 has given us personal
        data, contact us and we will delete it.
      </P>

      <H2>2. Information we collect</H2>
      <UL>
        <li>
          <strong>Account information:</strong> your email address, display
          name, and avatar (if provided), managed through our authentication
          provider.
        </li>
        <li>
          <strong>Guided session content:</strong> the problems you enter, your
          responses, hints you request, confidence ratings, reflections, and the
          reasoning summaries generated for you.
        </li>
        <li>
          <strong>Chat content:</strong> the messages you send, the assistant
          replies, and any files you upload.
        </li>
        <li>
          <strong>Usage data:</strong> counts of AI requests and basic activity
          needed to enforce rate limits and operate the Service.
        </li>
        <li>
          <strong>Technical data:</strong> standard server logs (such as IP
          address and request metadata) processed by our hosting and
          infrastructure providers for security and reliability.
        </li>
      </UL>

      <H2>3. How we use your information</H2>
      <UL>
        <li>
          To provide the Service and generate guided sessions and replies.
        </li>
        <li>To keep you signed in and secure your account.</li>
        <li>To enforce usage limits and prevent abuse.</li>
        <li>
          To improve the Service and respond to your feedback and support
          requests.
        </li>
        <li>To comply with legal obligations.</li>
      </UL>
      <P>
        Where required by law, our legal bases for processing are: performance
        of our contract with you, your consent, our legitimate interests in
        operating and securing the Service, and compliance with legal
        obligations.
      </P>

      <H2>4. AI processing</H2>
      <P>
        Qualia uses third-party AI models to generate questions, feedback, and
        chat replies. The text and files you submit are sent to our AI provider
        (currently Google, via the Gemini API) to produce responses. Please do
        not enter sensitive personal information you would not want processed
        this way. AI output can be inaccurate and should not be relied on as
        professional, medical, legal, or financial advice.
      </P>

      <H2>5. Service providers we share data with</H2>
      <P>
        We share data with vendors who process it on our behalf under contract.
        These currently include:
      </P>
      <UL>
        <li>
          <strong>Supabase</strong> (authentication, database, file storage).
          See <A href="https://supabase.com/privacy">Supabase Privacy</A>.
        </li>
        <li>
          <strong>Google</strong> (Gemini AI processing). See{" "}
          <A href="https://policies.google.com/privacy">Google Privacy</A>.
        </li>
        <li>
          <strong>Vercel</strong> (application hosting and privacy-friendly,
          cookieless analytics). See{" "}
          <A href="https://vercel.com/legal/privacy-policy">Vercel Privacy</A>.
        </li>
        <li>
          <strong>Tally</strong> (optional feedback forms). See{" "}
          <A href="https://tally.so/help/privacy-policy">Tally Privacy</A>.
        </li>
      </UL>
      <P>
        We do not sell your personal information, and we do not use it for
        cross-context behavioral advertising.
      </P>

      <H2>6. Cookies and local storage</H2>
      <P>
        We use a small number of essential cookies to keep you signed in
        (managed by our authentication provider). We use your browser&apos;s
        local storage for preferences such as theme, draft answers, and to
        remember whether you have seen certain prompts. We do not use
        advertising or cross-site tracking cookies. We use Vercel Analytics to
        count page views and visits; it is cookieless and does not track you
        across sites. If you open an embedded feedback form, that third party
        may set its own cookies.
      </P>

      <H2>7. Data retention</H2>
      <P>
        We keep your account and content until you delete them or close your
        account. Uploaded files may be removed automatically after a retention
        period. Some records may be retained longer where required for legal,
        security, or accounting purposes.
      </P>

      <H2>8. Your rights</H2>
      <P>
        Depending on where you live (for example under the GDPR, UK GDPR, or
        CCPA/CPRA), you may have rights to access, correct, delete, export, or
        restrict processing of your personal data, and to object or withdraw
        consent. You can:
      </P>
      <UL>
        <li>Export your data from your account settings.</li>
        <li>
          Delete your account and associated data from your account settings.
        </li>
        <li>
          Contact us at qualiaaiteam@gmail.com to exercise any other right.
        </li>
      </UL>
      <P>
        You may also lodge a complaint with your local data protection
        authority.
      </P>

      <H2>9. International transfers</H2>
      <P>
        Our providers may process data in the United States and other countries.
        Where required, we rely on appropriate safeguards such as the European
        Commission&apos;s Standard Contractual Clauses for international
        transfers.
      </P>

      <H2>10. Security</H2>
      <P>
        We use access controls, encryption in transit, row-level security, and a
        strict content security policy to protect your data. No system is
        perfectly secure, but we work to protect your information and will
        notify you and regulators of incidents as required by law.
      </P>

      <H2>11. Changes</H2>
      <P>
        We may update this policy. We will post the new version here and update
        the date above. Significant changes will be communicated where required.
      </P>

      <H2>12. Contact</H2>
      <P>Qualia. Email: qualiaaiteam@gmail.com.</P>
    </main>
  );
}
