/**
 * First-run provider-choice step. Readiness comes from the same
 * provider/settings/credential join as the Models page: any provider the user
 * can already talk to ends the step, and a user with none picks a directory
 * route or declares a custom one. Official DeepSeek is optional. The step
 * reuses that page's editor and create card in the onboarding plugin's shared
 * modal.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelsSettingsState, ModelsSettingsStore } from './store.ts'
import { onboardingChoices, onboardingReadiness, protocolChoices } from './store.ts'
import type { ModelsOperations } from './operations.ts'
import type { SettingsSchemaOperations } from './schema-operations.ts'
import { CustomProviderCard } from './CustomProviderCard.tsx'
import { ProviderEditor } from './ProviderEditor.tsx'
import type { en } from './locales.ts'
import { OnboardingModal } from './OnboardingModal.tsx'
import styles from './DeepSeekOnboardingDialog.module.css'

/** Sentinel for the hand-declared custom-provider card. */
const CUSTOM_ID = '__custom__'

/** Registration-side dependencies of {@link DeepSeekOnboardingDialog}. */
export interface DeepSeekOnboardingInjected {
  hooks: {
    /** Shared Models-page join state, bound by the slot renderer. */
    models: SnapshotStore<ModelsSettingsState>
  }
  /** Shared Models-page join controller. */
  controller: ModelsSettingsStore
  /** The Host operations the reused Models credential editor writes through. */
  operations: ModelsOperations
  /** Settings schema and immutable path callbacks. */
  schema: SettingsSchemaOperations
  /** Feature copy. */
  t: (key: keyof typeof en) => string
}

/** Slot owner props plus the feature's injected dependencies. */
export type DeepSeekOnboardingDialogProps =
  PropsRuntime<'settings.onboarding'> & InjectFace<DeepSeekOnboardingInjected>

/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
function assertNever(_value: never): never {
  throw new Error('unexpected provider onboarding state')
}

/**
 * Prompt a first-run user to choose any configurable provider while none can
 * serve requests and settings remain writable.
 * @param props - settings-shell owner state and Models feature dependencies.
 * @returns the onboarding modal or null when onboarding needs no intervention.
 */
export function DeepSeekOnboardingDialog(props: DeepSeekOnboardingDialogProps): ReactNode {
  const { complete, controller, useModels, operations, schema, t } = props
  const state = useModels(snapshot => snapshot)
  const readiness = onboardingReadiness(state)
  const choices = onboardingChoices(state)
  const [selected, setSelected] = useState<string | undefined>()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (state.status === 'idle') void controller.load()
  }, [controller, state.status])

  useEffect(() => {
    if (
      readiness.kind === 'adapter-absent'
      || readiness.kind === 'provider-ready'
      || readiness.kind === 'unavailable'
    ) complete()
  }, [complete, readiness.kind])

  useEffect(() => {
    if (selected === undefined || selected === CUSTOM_ID) return
    if (!choices.some(row => row.entry.provider === selected)) setSelected(undefined)
  }, [choices, selected])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) return choices
    return choices.filter(row =>
      row.entry.displayName.toLowerCase().includes(needle)
      || row.entry.provider.toLowerCase().includes(needle))
  }, [choices, query])

  switch (readiness.kind) {
    case 'loading':
    case 'adapter-absent':
    case 'provider-ready':
    case 'unavailable':
      return null
    case 'choose-provider':
      break
    /* v8 ignore next -- every current readiness variant is handled above */
    default:
      return assertNever(readiness)
  }

  const protocols = protocolChoices(state.namespaces.get('llm-pi-ai'), schema)
  const canCustom = protocols.length > 0
  const selectedRow = selected === undefined || selected === CUSTOM_ID
    ? undefined
    : choices.find(row => row.entry.provider === selected)
  const selectedNamespace = selectedRow === undefined
    ? undefined
    : state.namespaces.get(selectedRow.entry.settingsNs)

  const finishWrite = (changed: boolean): void => {
    if (!changed) {
      setSelected(undefined)
      return
    }
    void controller.load()
  }

  const piAi = state.namespaces.get('llm-pi-ai')
  if (selected === CUSTOM_ID && canCustom && piAi !== undefined) {
    return (
      <OnboardingModal title={t('customTitle')}>
        <div className={styles.editor}>
          <CustomProviderCard
            taken={state.rows.map(row => row.entry.provider)}
            protocols={protocols}
            revision={piAi.revision}
            operations={operations}
            t={t}
            readOnly={false}
            onClose={finishWrite}
          />
        </div>
      </OnboardingModal>
    )
  }

  if (selectedRow !== undefined && selectedNamespace !== undefined) {
    return (
      <OnboardingModal title={selectedRow.entry.displayName}>
        <div className={styles.editor}>
          <ProviderEditor
            provider={selectedRow.entry.provider}
            displayName={selectedRow.entry.displayName}
            namespace={selectedNamespace}
            schema={schema}
            settingsPath={selectedRow.entry.settingsPath}
            operations={operations}
            t={t}
            readOnly={false}
            hideTitle
            credentialOnly={selectedRow.entry.settingsPath.length === 0}
            credentialRequired={
              selectedRow.apiKeyEnv !== undefined
              && selectedRow.credential?.configured !== true
            }
            autoFocusCredential
            cancelLabelKey="onboardingBack"
            submitLabelKey="onboardingSave"
            submitBusyLabelKey="onboardingSaving"
            onClose={finishWrite}
          />
        </div>
      </OnboardingModal>
    )
  }

  return (
    <OnboardingModal title={t('onboardingTitle')} focusTitle>
      <p className={styles.description}>{t('onboardingDescription')}</p>
      {choices.length > 0
        ? (
          <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
            placeholder={t('onboardingSearch')}
            aria-label={t('onboardingSearch')}
            autoFocus
          />
        )
        : null}
      <ul className={styles.list}>
        {filtered.map(row => (
          <li key={row.entry.provider}>
            <button
              type="button"
              className={styles.choice}
              onClick={() => { setSelected(row.entry.provider) }}
            >
              {row.entry.displayName}
            </button>
          </li>
        ))}
        {choices.length > 0 && filtered.length === 0
          ? <li className={styles.empty}>{t('onboardingEmpty')}</li>
          : null}
        {canCustom
          ? (
            <li>
              <button
                type="button"
                className={styles.choice}
                onClick={() => { setSelected(CUSTOM_ID) }}
              >
                {t('customAdd')}
              </button>
            </li>
          )
          : null}
      </ul>
      <div className={styles.actions}>
        <button type="button" className={styles.later} onClick={() => { complete() }}>
          {t('onboardingLater')}
        </button>
      </div>
    </OnboardingModal>
  )
}
