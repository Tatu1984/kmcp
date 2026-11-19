import * as React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  // Absolute: the portal's title template would brand it KMCP, and this page
  // belongs to the Smart Parking apps.
  title: { absolute: "Privacy policy · Smart Parking" },
  description:
    "How Infinititech Partners collects, uses, shares and protects personal data in the Smart Parking and SP Vendor apps.",
};

const COMPANY = "Infinititech Partners";
const CONTACT = "infinititechpartners@gmail.com";
const EFFECTIVE = "19 November 2026";

/**
 * The privacy policy for Smart Parking (citizens) and SP Vendor (attendants).
 *
 * Every retention period here is the one `kmcp-backend` actually enforces —
 * see `retention.policy.ts`. Change one and this page has to change with it,
 * or the policy stops being true.
 */
export default function PrivacyPolicyPage() {
  return (
    <article className="space-y-10 text-[15px] leading-7 text-foreground/90">
      <header className="space-y-3 border-b border-border pb-8">
        <p className="text-sm font-medium tracking-wide text-primary">Smart Parking · SP Vendor</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Privacy policy
        </h1>
        <p className="text-sm text-muted-foreground">Effective {EFFECTIVE}</p>
        <p>
          This policy explains what personal data {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
          collects through the <strong>Smart Parking</strong> app for drivers, the{" "}
          <strong>SP Vendor</strong> app for parking attendants, and the services behind them; why
          we collect it; who we share it with; how long we keep it; and the rights you have over it,
          including under India&rsquo;s Digital Personal Data Protection Act, 2023.
        </p>
      </header>

      <Section id="who-we-are" title="1. Who we are">
        <p>
          {COMPANY} builds and operates Smart Parking, a service for finding on-street parking in
          Kolkata, paying for a parking session and receiving a receipt, and SP Vendor, the app
          attendants use at the kerb to start and end those sessions and collect fares. We decide
          how the personal data described here is used, and we are responsible for it.
        </p>
        <p>
          Questions about this policy or your data: <Mail />.
        </p>
      </Section>

      <Section id="what-we-collect" title="2. What we collect">
        <h3 className="font-semibold text-foreground">If you use Smart Parking</h3>
        <List
          items={[
            <>
              <strong>Email address</strong>, to create your account and sign you in. We email you a
              six-digit code each time; there is no password. We store the code only in a scrambled
              (hashed) form.
            </>,
            <>
              <strong>Name</strong>, if you give one.
            </>,
            <>
              <strong>Precise location</strong>, only while you use the app and only if you allow it,
              to show the car parks nearest to you. It is sent with that search and is not saved to
              your account. You can refuse or withdraw the permission in your phone&rsquo;s settings;
              the app then shows a default area instead.
            </>,
            <>
              <strong>Vehicle registration numbers</strong>, so we can match parking sessions an
              attendant starts for your vehicle to you.
            </>,
            <>
              <strong>Parking sessions</strong>: the car park and bay, start and end times, the fare
              and any overstay charge.
            </>,
            <>
              <strong>Payments</strong>: the amount, status and payment reference. Payments are
              processed by Razorpay; your card, UPI or bank details go to Razorpay directly and we
              never receive or store them.
            </>,
          ]}
        />

        <h3 className="font-semibold text-foreground">When you park, whichever app you use</h3>
        <List
          items={[
            <>
              <strong>Photographs of the vehicle</strong>, including its number plate, taken by the
              attendant when a session starts and ends. They are the evidence behind the charge and
              settle disputes about it.
            </>,
            <>
              <strong>The attendant&rsquo;s GPS position</strong> when the session starts and ends,
              to show the session was recorded at the car park that was billed.
            </>,
          ]}
        />

        <h3 className="font-semibold text-foreground">If you use SP Vendor as an attendant</h3>
        <List
          items={[
            <>
              <strong>Name, mobile number and email address</strong>, provided by the parking
              operator that employs you.
            </>,
            <>
              <strong>Password</strong>, stored only in hashed form, and the sign-in codes we email
              you.
            </>,
            <>
              <strong>A device identifier</strong> for the handset your account is registered to, so
              the account cannot be used from another phone.
            </>,
            <>
              <strong>Precise location</strong> when you start or end a session, to confirm you are
              in your assigned zone.
            </>,
            <>
              <strong>Camera</strong>, to photograph number plates. The app does not access your
              photo library.
            </>,
            <>
              <strong>Work records</strong>: shifts, sessions you recorded and cash you collected.
            </>,
          ]}
        />

        <h3 className="font-semibold text-foreground">For everyone who signs in</h3>
        <p>
          <strong>Sign-in and security records</strong>: the time of each sign-in, your IP address
          and the approximate location and network provider it implies, and your device type and app
          platform. We use these to protect accounts and detect misuse.
        </p>
        <p>
          We do not use advertising, we do not track you across other apps or websites, and the apps
          contain no third-party analytics or advertising code.
        </p>
      </Section>

      <Section id="how-we-use" title="3. How we use it">
        <List
          items={[
            "To sign you in and keep your account secure.",
            "To show nearby car parks and their availability.",
            "To record parking sessions, calculate fares from the published rate card, and take payment.",
            "To send you sign-in codes and receipts by email.",
            "To resolve disputes about a charge, using the session record and photographs.",
            "To let parking operators manage their attendants, shifts and collections.",
            "To detect and investigate fraud, misuse and security incidents.",
            "To meet our legal, tax and accounting obligations.",
          ]}
        />
        <p>
          We rely on your consent where the law requires it, such as for precise location, and you
          can withdraw it at any time. Otherwise we process data because it is needed to provide the
          service you asked for, or to comply with the law.
        </p>
      </Section>

      <Section id="sharing" title="4. Who we share it with">
        <p>We do not sell your personal data. We share it only with:</p>
        <List
          items={[
            <>
              <strong>The parking operator and its supervisors</strong> responsible for the car park,
              and the officials who oversee those car parks, who see the session records, photographs
              and payments for the zones they are responsible for.
            </>,
            <>
              <strong>Service providers</strong> who process data on our behalf and only on our
              instructions: Razorpay (payments), Resend (email delivery), Vercel (application
              hosting), Neon (database), Cloudflare (photo storage), and, where enabled, an
              error-monitoring service and an IP-address lookup service.
            </>,
            <>
              <strong>Authorities</strong>, when the law requires us to, or to protect the rights,
              property or safety of our users or others.
            </>,
          ]}
        />
        <p>
          Some of these providers store data on servers outside India, including in the United
          States. Where we transfer data abroad we do so as Indian law permits, and our providers are
          bound to protect it.
        </p>
      </Section>

      <Section id="retention" title="5. How long we keep it">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-border text-foreground">
              <tr>
                <th className="py-2 pr-4 font-semibold">Data</th>
                <th className="py-2 font-semibold">Kept for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <Row data="Sign-in codes" kept="7 days, then deleted" />
              <Row data="Vehicle photographs from a parking session" kept="90 days, then deleted" />
              <Row data="GPS positions recorded on a parking session" kept="90 days, then removed from the session" />
              <Row data="Sign-in and security records" kept="180 days, then deleted" />
              <Row data="Records of emails and messages we sent" kept="180 days, then deleted" />
              <Row data="Audit trail of changes made by staff" kept="7 years" />
              <Row
                data="Parking sessions and payments"
                kept="As long as tax and accounting law requires. After an account is deleted they are kept without your name or contact details."
              />
              <Row data="Your account" kept="Until you delete it" />
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="rights" title="6. Your rights">
        <p>You can ask us to:</p>
        <List
          items={[
            "tell you what personal data we hold about you and give you a copy;",
            "correct data that is inaccurate or incomplete;",
            "erase your data, subject to what the law requires us to keep;",
            "withdraw a consent you gave;",
            "nominate someone to exercise these rights for you if you die or become unable to.",
          ]}
        />
        <p>
          Email <Mail /> from the address on your account, or tell us the registration number and
          mobile number we hold if you have no account. We may ask you to confirm your identity, and
          we aim to respond within 30 days.
        </p>
        <p>
          <strong>Grievances.</strong> Complaints about how we handle your data go to our Grievance
          Officer at <Mail />. If you are not satisfied with our response, you may complain to the
          Data Protection Board of India.
        </p>
      </Section>

      <Section id="delete-account" title="7. Deleting your account">
        <p>To delete your Smart Parking or SP Vendor account and the personal data linked to it:</p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            Email <Mail /> from the address on your account, with the subject{" "}
            <em>&ldquo;Delete my account&rdquo;</em>. Attendants may also ask their supervisor.
          </li>
          <li>We confirm the request is yours and delete the account within 30 days.</li>
        </ol>
        <p>
          We delete your email address, name, mobile number, vehicles and sign-in records. Parking
          sessions and payments are financial records that the law requires us to keep; we keep them
          with your name and contact details removed, so they no longer identify you. Photographs and
          location data are deleted on the schedule in section 5, if they have not been already.
        </p>
      </Section>

      <Section id="security" title="8. How we protect it">
        <p>
          Data travels over encrypted (HTTPS) connections. Passwords and sign-in codes are stored only
          in hashed form. Staff access is limited by role, so each person sees only what their job
          needs, and changes they make are recorded in an audit trail. No system is perfectly secure;
          if a breach affects your data we will tell you and the Data Protection Board as the law
          requires.
        </p>
      </Section>

      <Section id="children" title="9. Children">
        <p>
          Smart Parking and SP Vendor are not intended for anyone under 18, and we do not knowingly
          collect personal data from children. If you believe a child has given us personal data,
          contact us and we will delete it.
        </p>
      </Section>

      <Section id="changes" title="10. Changes to this policy">
        <p>
          We will post any change on this page and update the effective date above. If a change
          materially affects how we use your data, we will tell you in the app or by email before it
          takes effect.
        </p>
      </Section>

      <Section id="contact" title="11. Contact">
        <p>
          {COMPANY}
          <br />
          Email: <Mail />
        </p>
      </Section>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Row({ data, kept }: { data: string; kept: string }) {
  return (
    <tr className="align-top">
      <td className="py-2 pr-4">{data}</td>
      <td className="py-2 text-muted-foreground">{kept}</td>
    </tr>
  );
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT}`} className="font-medium text-primary underline underline-offset-4">
      {CONTACT}
    </a>
  );
}
