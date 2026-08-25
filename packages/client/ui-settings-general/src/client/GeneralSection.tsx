/** The General section: one column rendering feature-owned item contributions. */
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { APP_NAME, APP_VERSION_TAG } from './version.ts'
import css from './GeneralSection.module.css'

/** Full component props: section owner share plus item render share. */
export type GeneralSectionComponentProps =
  PropsRuntime<'settings.section'> & PropsRenderSlots<'settings.general.item'>

/**
 * Render the General section content column.
 * @param props - composed slot props (contract/slots.ts).
 * @returns the section element tree.
 */
export function GeneralSection({ renderSlot }: GeneralSectionComponentProps) {
  return (
    <div className={css.section}>
      {renderSlot('settings.general.item', {})}
      <div className={css.versionRow}>
        <div className={css.versionText}>
          <div className={css.versionTitle}>Versão</div>
          <div className={css.versionSubtitle}>{APP_NAME} Agent Harness</div>
        </div>
        <span className={css.versionTag}>{APP_VERSION_TAG}</span>
      </div>
    </div>
  )
}
