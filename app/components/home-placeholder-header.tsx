'use client';

const DEFAULT_GREETING = 'Hello';

export function HomePlaceholderHeader() {
  const userName = process.env.NEXT_PUBLIC_USER_NAME?.trim();
  const title = userName ? `Hello, ${userName}` : DEFAULT_GREETING;

  return (
    <div className="owui-placeholder-hero">
      <div className="owui-placeholder-title-row">
        <h1 className="owui-placeholder-title">
          <span className="owui-placeholder-title-text">{title}</span>
        </h1>
      </div>
    </div>
  );
}
