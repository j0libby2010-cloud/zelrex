import { ZelrexWebsite } from "../../core/websiteTypes";
import { Hero } from "../components/Hero";

export function HomePage({ website }: { website: ZelrexWebsite }) {
  const copy = website.copy.home;

  return (
    <>
      <Hero
        website={website}
        title={copy.hero.headline}
        subtitle={copy.hero.subheadline}
      />

      {copy.sections.map((section, i) => (
        <section key={i} style={{ maxWidth: 900 }}>
          {section.eyebrow && <small>{section.eyebrow}</small>}
          <h2>{section.title}</h2>
          {section.body && <p>{section.body}</p>}

          {section.items && (
            <ul>
              {section.items.map((item, j) => (
                <li key={j}>
                  <strong>{item.title}</strong> — {item.description}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
