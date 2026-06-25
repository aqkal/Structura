import type { Metadata } from "next";

import { A, H1, H2, P, UL, Updated } from "@/components/legal/legal-ui";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <main className="legal">
      <H1>Terms of Service</H1>
      <Updated>Last updated: June 25, 2026. Effective: June 25, 2026.</Updated>

      <P>
        These Terms of Service (&quot;Terms&quot;) govern your use of Qualia
        (the &quot;Service&quot;), operated by Qualia. By using the Service, you
        agree to these Terms and to our <A href="/privacy">Privacy Policy</A>.
        If you do not agree, do not use the Service.
      </P>

      <H2>1. Eligibility</H2>
      <P>
        You must be at least 13 years old to use Qualia. If you are between 13
        and the age of majority where you live, you may use the Service only
        with the involvement of a parent, guardian, or school, and you confirm
        they permit your use. If you are under 16 in the EEA or UK, you confirm
        you have the consent required by local law.
      </P>

      <H2>2. What Qualia is</H2>
      <P>
        Qualia is an educational reasoning tool. It guides your thinking with
        questions and feedback. it is not a tutor, expert, or professional
        adviser, and it does not provide professional, medical, legal, or
        financial advice. It is designed to help you reason, not to give you
        final answers.
      </P>

      <H2>3. AI and accuracy</H2>
      <P>
        The Service uses artificial intelligence, which can produce inaccurate,
        incomplete, or misleading output. You are responsible for evaluating and
        verifying anything you rely on. Do not submit content you are not
        allowed to share, and do not rely on the Service for decisions that
        require a qualified professional.
      </P>

      <H2>4. Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Use the Service for anything unlawful, harmful, or abusive.</li>
        <li>
          Attempt to cheat, plagiarize, or violate any school or exam policy.
        </li>
        <li>
          Upload content that infringes others&apos; rights or contains malware.
        </li>
        <li>
          Probe, scrape, overload, reverse engineer, or circumvent limits or
          security of the Service.
        </li>
        <li>Use the Service to build a competing product from our outputs.</li>
      </UL>

      <H2>5. Your content</H2>
      <P>
        You keep ownership of the content you submit. You grant us a limited
        license to process and store it to operate and improve the Service,
        including sending it to our AI provider to generate responses. You are
        responsible for your content and confirm you have the right to submit
        it.
      </P>

      <H2>6. Accounts</H2>
      <P>
        You are responsible for activity under your account and for keeping your
        login secure. Tell us promptly if you suspect unauthorized use.
      </P>

      <H2>7. Intellectual property</H2>
      <P>
        The Service, including its software, design, and branding, belongs to
        Qualia and its licensors. These Terms do not grant you any rights to our
        trademarks or to use the Service beyond what is permitted here.
      </P>

      <H2>8. Disclaimers</H2>
      <P>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, to the fullest extent permitted by law.
        We do not warrant that the Service will be uninterrupted, error-free, or
        that AI output will be accurate.
      </P>

      <H2>9. Limitation of liability</H2>
      <P>
        To the fullest extent permitted by law, Qualia will not be liable for
        any indirect, incidental, special, consequential, or punitive damages,
        or for any loss arising from your reliance on AI output. Nothing in
        these Terms limits liability that cannot be limited by law.
      </P>

      <H2>10. Termination</H2>
      <P>
        You may stop using the Service and delete your account at any time. We
        may suspend or terminate access if you violate these Terms or to protect
        the Service.
      </P>

      <H2>11. Governing law</H2>
      <P>
        These Terms are governed by the laws of Queensland, Australia, without
        regard to conflict-of-law rules. Disputes will be resolved in the courts
        of Queensland, Australia, unless local consumer law gives you other
        rights.
      </P>

      <H2>12. Changes</H2>
      <P>
        We may update these Terms. We will post the new version here and update
        the date above. Continued use after changes means you accept them.
      </P>

      <H2>13. Contact</H2>
      <P>Qualia. Email: qualiaaiteam@gmail.com.</P>
    </main>
  );
}
