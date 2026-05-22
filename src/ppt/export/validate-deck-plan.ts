import { PPT_LAYOUT_CATALOG } from '../schemas/layout-catalog';
import type { DeckPlan, DeckSlide } from '../schemas/deck-plan';
import type { ValidationIssue } from '../schemas/validation';

function textLen(value: string | undefined): number {
  return (value ?? '').trim().length;
}

function addIssue(
  issues: ValidationIssue[],
  code: string,
  message: string,
  options?: {
    slideIndex?: number;
    field?: string;
    suggestedAction?: string;
  },
): void {
  issues.push({
    code,
    message,
    slideIndex: options?.slideIndex,
    field: options?.field,
    suggestedAction: options?.suggestedAction,
  });
}

function validateSlide(slide: DeckSlide, issues: ValidationIssue[]): void {
  const index = slide.index;
  const limits = PPT_LAYOUT_CATALOG[slide.layoutId];
  if (!limits) {
    addIssue(issues, 'unknown_layout', `Unknown layout: ${slide.layoutId}`, {
      slideIndex: index,
      field: 'layoutId',
    });
    return;
  }

  const title = 'title' in slide ? slide.title : '';
  if (!textLen(title)) {
    addIssue(issues, 'missing_title', 'Slide title is required.', {
      slideIndex: index,
      field: 'title',
    });
  } else if (textLen(title) > limits.maxTitleChars) {
    addIssue(
      issues,
      'title_too_long',
      `Title is ${textLen(title)} chars; max is ${limits.maxTitleChars}.`,
      {
        slideIndex: index,
        field: 'title',
        suggestedAction: 'Shorten the title.',
      },
    );
  }

  const subtitle = 'subtitle' in slide ? slide.subtitle : undefined;
  if (limits.maxSubtitleChars && subtitle && textLen(subtitle) > limits.maxSubtitleChars) {
    addIssue(
      issues,
      'subtitle_too_long',
      `Subtitle is ${textLen(subtitle)} chars; max is ${limits.maxSubtitleChars}.`,
      {
        slideIndex: index,
        field: 'subtitle',
        suggestedAction: 'Shorten the subtitle.',
      },
    );
  }

  const bulletFields = ['bullets', 'leftBullets', 'rightBullets'] as const;
  for (const field of bulletFields) {
    if (!(field in slide)) {
      continue;
    }
    const bullets = slide[field as keyof typeof slide];
    if (!Array.isArray(bullets)) {
      continue;
    }

    const maxBullets = limits.maxBullets;
    if (maxBullets && bullets.length > maxBullets) {
      addIssue(
        issues,
        'too_many_bullets',
        `${field} has ${bullets.length} bullets; max is ${maxBullets}.`,
        {
          slideIndex: index,
          field,
          suggestedAction: 'Merge or remove bullets.',
        },
      );
    }

    const maxBulletChars = limits.maxBulletChars;
    for (const [itemIndex, bullet] of bullets.entries()) {
      if (!textLen(bullet)) {
        addIssue(issues, 'empty_bullet', 'Bullet text is empty.', {
          slideIndex: index,
          field: `${field}.${itemIndex}`,
        });
      } else if (maxBulletChars && textLen(bullet) > maxBulletChars) {
        addIssue(
          issues,
          'bullet_too_long',
          `Bullet is ${textLen(bullet)} chars; max is ${maxBulletChars}.`,
          {
            slideIndex: index,
            field: `${field}.${itemIndex}`,
            suggestedAction: 'Shorten this bullet.',
          },
        );
      }
    }
  }
}

export function validateDeckPlan(plan: DeckPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const slides = plan.slides ?? [];

  if (!slides.length) {
    addIssue(issues, 'empty_deck', 'Deck has no slides.', {
      suggestedAction: 'Add at least three slides.',
    });
    return issues;
  }

  for (const slide of slides) {
    validateSlide(slide, issues);
  }

  return issues;
}
