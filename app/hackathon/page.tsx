import Link from "next/link";
import { Duck } from "@/components/duck";
import { Info, ArrowUpRight } from "lucide-react";
export default function Hackathon() {
  return (
    <main className="hackathon-page">
      <Link href="/" className="brand">
        <Duck />
        boatduck
      </Link>
      <div className="eyebrow">
        BOAT HACKATHON · SAN FRANCISCO · NOVEMBER 2026
      </div>
      <h1>
        Built for the boat.
        <br />
        Ready for the whole world.
      </h1>
      <p>
        Boatduck sends a small fleet of Boat.dev sandboxes to explore the web
        through Context.dev. Vercel AI Gateway makes sense of the evidence.
        Supabase keeps your discoveries together.
      </p>
      <h2>The voyage to Demo Day</h2>
      <p>
        Application code is only one part of eligibility. These requirements
        come from the organizer’s Teamily announcement.
      </p>
      <table>
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Evidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Accepted as a builder</td>
            <td>Acceptance from BoatHackathon.com</td>
            <td>Needs confirmation</td>
          </tr>
          <tr>
            <td>Ship code from aboard any boat</td>
            <td>At least one line shipped while aboard</td>
            <td>Needs confirmation</td>
          </tr>
          <tr>
            <td>Post a public boat photo</td>
            <td>#boathackathon, @boathackathon, @teamily</td>
            <td>Public link needed</td>
          </tr>
          <tr>
            <td>Complete the submission</td>
            <td>Include the public photo URL</td>
            <td>Due Nov. 20, 5 p.m. PT</td>
          </tr>
          <tr>
            <td>Show Boat Demo Day</td>
            <td>Invitation from organizers</td>
            <td>Nov. 21, 1–5 p.m. PT</td>
          </tr>
        </tbody>
      </table>
      <div className="notice">
        <Info size={19} />
        <span>
          <strong>Private-AI prize: not yet qualified.</strong> The sponsor
          announcement requires use of encrypted AI tokens. Standard AI Gateway
          calls and private saved searches do not establish qualification.
        </span>
      </div>
      <Link href="/" className="primary">
        Back to exploring <ArrowUpRight size={16} />
      </Link>
      <footer>
        <a href="https://boathackathon.com" target="_blank" rel="noreferrer">
          Official hackathon
        </a>
        <a
          href="https://teamily.ai/invite/group/488655921"
          target="_blank"
          rel="noreferrer"
        >
          Organizer announcements
        </a>
      </footer>
    </main>
  );
}
