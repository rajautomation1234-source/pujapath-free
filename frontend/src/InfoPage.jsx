import React from "react";

const pageContent = {
  "About Us": {
    icon: "🪔",
    title: "About PujaPath Live",
    paragraphs: [
      "PujaPath Live is a Durga Puja companion website designed to help visitors discover pandals and plan their Puja journey more easily.",
      "The website brings pandal locations, map viewing, search, zone filtering, nearby places, walking routes, checklist tools, planning tools and budget tools together in one place.",
      "Our goal is to make Puja exploration simple, useful and enjoyable for everyone."
    ]
  },

  "Our Vision": {
    icon: "🌟",
    title: "Our Vision",
    paragraphs: [
      "Our vision is to make Durga Puja exploration easier, smarter and more organized.",
      "We want visitors to spend less time searching for information and more time enjoying the Puja experience.",
      "PujaPath Live is designed to grow into a helpful digital companion for discovering pandals, planning visits and navigating between locations."
    ]
  },

  "Privacy Policy": {
    icon: "🔒",
    title: "Privacy Policy",
    paragraphs: [
      "PujaPath Live respects your privacy.",
      "Some features may request access to your location, such as nearby essentials and walking navigation. Your browser or device controls whether location permission is granted.",
      "Account features may use information required for sign-in and account management.",
      "We aim to use information only for providing and improving the features of the website."
    ],
    notice:
      "Important: This page is a simple project privacy notice. A production website should review its privacy requirements and update this notice as the application's data practices evolve."
  },

  "Terms": {
    icon: "📜",
    title: "Terms & Conditions",
    paragraphs: [
      "By using PujaPath Live, you agree to use the website responsibly and for lawful purposes.",
      "Pandal locations, routes, maps and other information should be treated as helpful guidance and may change.",
      "Users should follow local traffic rules, Puja committee instructions and public safety instructions while travelling.",
      "PujaPath Live should not be treated as a replacement for official emergency, traffic or public-safety services."
    ]
  },

  "Location Policy": {
    icon: "📍",
    title: "Location & GPS Policy",
    paragraphs: [
      "Location access is used for location-based features such as showing your current position, finding nearby essentials and creating walking routes.",
      "Location access is controlled by your browser or device. You may allow or deny the permission.",
      "For navigation, GPS accuracy may vary depending on your device, surroundings, network conditions and other factors.",
      "Always check your surroundings while walking and never depend only on the map."
    ]
  },

  "Safety": {
    icon: "🛡️",
    title: "Safety Information",
    paragraphs: [
      "Stay alert while walking, especially during crowded Puja days and nights.",
      "Follow traffic signals, police instructions and local crowd-management instructions.",
      "Do not look continuously at your phone while crossing roads or walking through crowded areas.",
      "Keep your belongings secure and stay with your group when possible.",
      "For emergencies, contact the appropriate local emergency service instead of relying only on this website."
    ]
  },

  "Contact": {
    icon: "✉️",
    title: "Contact Us",
    paragraphs: [
      "Have you found a wrong pandal name, location or other website problem?",
      "You can use this section to report issues and provide suggestions for improving PujaPath Live.",
      "Thank you for helping make the project more useful for Puja visitors."
    ]
  },

  "User Guide": {
    icon: "📘",
    title: "PujaPath Live User Guide",
    paragraphs: [
      "The PujaPath Live User Guide explains how to use the website step by step.",
      "It covers the map, pandal search, zone filtering, current location, nearby essentials, route planning, navigation, checklist, planner, budget tracker and other features."
    ],
    guideButton: true
  }
};

export default function InfoPage({
  page,
  onBack
}) {
  const content = pageContent[page];

  if (!content) {
    return null;
  }

  return (
    <section
      className="info-page"
      aria-label={content.title}
    >
      <div className="info-page-header">
        <button
          type="button"
          className="info-back-button"
          onClick={onBack}
        >
          ← Back to App
        </button>

        <div className="info-title">
          <span className="info-icon">
            {content.icon}
          </span>

          <h2>
            {content.title}
          </h2>
        </div>
      </div>

      <div className="info-page-content">
        {content.paragraphs.map(
          (paragraph, index) => (
            <p key={index}>
              {paragraph}
            </p>
          )
        )}

        {content.notice && (
          <div className="info-notice">
            {content.notice}
          </div>
        )}

        {content.guideButton && (
          <a
            className="info-guide-button"
            href="/PujaPath_Live_User_Guide_15_Pages.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            📘 Open User Guide PDF
          </a>
        )}
      </div>
    </section>
  );
}