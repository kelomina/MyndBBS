import React from 'react';

export const PrivacyEn = () => (
  <>
    <h1>Privacy Policy</h1>
    <p><strong>Effective Date:</strong> {new Date().toLocaleDateString('en-US')}</p>

    <p>This Privacy Policy explains how MyndBBS ("we", "our", or "us") collects, uses, shares, and protects your personal information. We are committed to complying with applicable data protection laws, including the European Union's General Data Protection Regulation (GDPR) and the Personal Information Protection Law of the People's Republic of China (PIPL).</p>

    <h2>1. Information We Collect</h2>
    <p>We may collect the following types of information when you use our Service:</p>
    <ul>
      <li><strong>Account Information:</strong> Username, email address, passwords, and Passkeys (WebAuthn credentials).</li>
      <li><strong>Profile Information:</strong> Bios, avatars, and other optional profile details.</li>
      <li><strong>User-Generated Content:</strong> Posts, comments, messages, and upvotes.</li>
      <li><strong>Technical Data:</strong> IP addresses, browser types, device information, and Cookies (see our Cookie Consent Modal for detailed preferences).</li>
    </ul>

    <h2>2. Lawful Basis and Purpose of Processing (GDPR & PIPL)</h2>
    <p>We process your personal data under the following lawful bases:</p>
    <ul>
      <li><strong>Consent:</strong> Where you have provided explicit consent (e.g., for analytics and marketing cookies, or processing sensitive personal information under PIPL).</li>
      <li><strong>Contractual Necessity:</strong> To provide you with the Service, create your account, and enable platform features.</li>
      <li><strong>Legitimate Interests:</strong> To maintain the security of our platform, prevent fraud, and improve our services.</li>
      <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulations.</li>
    </ul>

    <h2>3. Information Sharing and Disclosure</h2>
    <p>We do not sell your personal information. We may share your data with:</p>
    <ul>
      <li><strong>Service Providers:</strong> Third-party vendors who assist us with hosting, database management, and analytics (subject to strict data processing agreements).</li>
      <li><strong>Legal Authorities:</strong> When required by law, subpoena, or other legal processes.</li>
    </ul>

    <h2>4. Cross-Border Data Transfers</h2>
    <p>Your data may be stored and processed in countries other than your own. </p>
    <ul>
      <li><strong>For EU Users (GDPR):</strong> We ensure appropriate safeguards are in place, such as Standard Contractual Clauses (SCCs) or adequacy decisions by the European Commission.</li>
      <li><strong>For Chinese Users (PIPL):</strong> We will obtain your separate explicit consent before transferring your personal information overseas and will conduct necessary security assessments as required by the Cyberspace Administration of China (CAC).</li>
    </ul>

    <h2>5. Data Retention</h2>
    <p>We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, or as required by law. If you delete your account, your personal data will be anonymized or securely deleted within a reasonable timeframe.</p>

    <h2>6. Your Data Subject Rights</h2>
    <p>Under both GDPR and PIPL, you have the following rights regarding your personal data:</p>
    <ul>
      <li><strong>Right to Access:</strong> You can request a copy of the personal data we hold about you.</li>
      <li><strong>Right to Rectification:</strong> You can request that we correct inaccurate or incomplete data.</li>
      <li><strong>Right to Erasure (Right to be Forgotten):</strong> You can request the deletion of your personal data.</li>
      <li><strong>Right to Withdraw Consent:</strong> You can withdraw your consent at any time (e.g., via the Cookie Preferences menu).</li>
      <li><strong>Right to Data Portability (GDPR):</strong> You can request your data in a structured, commonly used, and machine-readable format.</li>
      <li><strong>Right to Restrict or Object to Processing:</strong> You can object to certain types of processing, such as direct marketing.</li>
      <li><strong>Right to Explanation (PIPL):</strong> You have the right to request an explanation of our personal information handling rules and automated decision-making.</li>
    </ul>
    <p>To exercise these rights, please contact us or use the account settings provided in the platform.</p>

    <h2>7. Protection of Minors</h2>
    <p>Our Service is not directed to children under the age of 14 (or 16 in certain EU member states). We do not knowingly collect personal information from children without verifiable parental consent. If we learn that we have collected such information without parental consent, we will delete it promptly. Under PIPL, the personal information of minors under 14 is considered sensitive personal information.</p>

    <h2>8. Data Security</h2>
    <p>We implement appropriate technical and organizational measures to protect your personal data against accidental or unlawful destruction, loss, alteration, unauthorized disclosure, or access.</p>

    <h2>9. Contact Us</h2>
    <p>If you have any questions or concerns about this Privacy Policy, or wish to exercise your data subject rights, please contact our Data Protection Officer (DPO) / Personal Information Protection Officer at: <strong>privacy@myndbbs.example.com</strong>.</p>
  </>
);
