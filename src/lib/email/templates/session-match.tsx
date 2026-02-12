import * as React from "react";

interface SessionMatchEmailProps {
  playerName: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  sessionLocation: string;
  sessionCity: string;
  skillLevel: string;
  gameType: string;
  sessionUrl: string;
}

export function SessionMatchEmail({
  playerName,
  sessionTitle,
  sessionDate,
  sessionTime,
  sessionLocation,
  sessionCity,
  skillLevel,
  gameType,
  sessionUrl,
}: SessionMatchEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: 600,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <h2 style={{ color: "#1a1a1a", margin: "0 0 16px 0" }}>
        New session matches your availability!
      </h2>
      <p style={{ color: "#374151", margin: "0 0 8px 0" }}>Hi {playerName},</p>
      <p style={{ color: "#374151", margin: "0 0 16px 0" }}>
        A new badminton session has been created that fits your schedule:
      </p>
      <div
        style={{
          background: "#f4f4f5",
          borderRadius: 8,
          padding: 16,
          margin: "0 0 20px 0",
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", color: "#1a1a1a" }}>
          {sessionTitle}
        </h3>
        <p style={{ margin: "4px 0", color: "#374151", fontSize: 14 }}>
          Date: {sessionDate}
        </p>
        <p style={{ margin: "4px 0", color: "#374151", fontSize: 14 }}>
          Time: {sessionTime}
        </p>
        <p style={{ margin: "4px 0", color: "#374151", fontSize: 14 }}>
          Location: {sessionLocation}, {sessionCity}
        </p>
        <p style={{ margin: "4px 0", color: "#374151", fontSize: 14 }}>
          Level: {skillLevel} | Type: {gameType}
        </p>
      </div>
      <a
        href={sessionUrl}
        style={{
          display: "inline-block",
          background: "#18181b",
          color: "#ffffff",
          padding: "10px 24px",
          borderRadius: 6,
          textDecoration: "none",
          fontWeight: "bold",
          fontSize: 14,
        }}
      >
        View Session
      </a>
      <p
        style={{
          color: "#9ca3af",
          fontSize: 12,
          marginTop: 24,
          marginBottom: 0,
        }}
      >
        You received this because your availability matches this session. You
        can manage your notification preferences in your ShuttleMates
        availability settings.
      </p>
    </div>
  );
}
