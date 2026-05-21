import { LearnMoreLink } from "@calcom/features/eventtypes/components/LearnMoreLink";
import type {
  EventTypeSetup,
  FormValues,
  InputClassNames,
  SelectClassNames,
  SettingsToggleClassNames,
} from "@calcom/features/eventtypes/lib/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Frequency } from "@calcom/prisma/zod-utils";
import type { RecurringEvent } from "@calcom/types/Calendar";
import classNames from "@calcom/ui/classNames";
import { Alert } from "@calcom/ui/components/alert";
import { Select, SettingsToggle, TextField } from "@calcom/ui/components/form";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

export type RecurringEventControllerProps = {
  eventType: EventTypeSetup;
  paymentEnabled: boolean;
  customClassNames?: EventRecurringTabCustomClassNames;
};

export type EventRecurringTabCustomClassNames = {
  container?: string;
  recurringToggle?: SettingsToggleClassNames;
  frequencyInput?: InputClassNames;
  frequencyUnitSelect?: SelectClassNames;
  maxEventsInput?: {
    countInput?: string;
    labelText?: string;
    suffixText?: string;
    container?: string;
  };
  experimentalAlert?: string;
  paymentAlert?: string;
};

export default function RecurringEventController({
  eventType,
  paymentEnabled,
  customClassNames,
}: RecurringEventControllerProps) {
  const { t } = useLocale();
  const formMethods = useFormContext<FormValues>();
  const [recurringEventState, setRecurringEventState] = useState<RecurringEvent | null>(
    formMethods.getValues("recurringEvent")
  );
  const isSeatsOffered = !!formMethods.getValues("seatsPerTimeSlot");
  const hasBookingLimitPerBooker = !!formMethods.getValues("maxActiveBookingsPerBooker");
  const recurringEventFreqOptions = [
    { label: t("daily_frequency"), value: `${Frequency.DAILY}:1`, freq: Frequency.DAILY, interval: 1 },
    { label: t("weekly_frequency"), value: `${Frequency.WEEKLY}:1`, freq: Frequency.WEEKLY, interval: 1 },
    { label: t("bi_weekly_frequency"), value: `${Frequency.WEEKLY}:2`, freq: Frequency.WEEKLY, interval: 2 },
    { label: t("monthly_frequency"), value: `${Frequency.MONTHLY}:1`, freq: Frequency.MONTHLY, interval: 1 },
  ];
  const selectedRecurringEventFreqOption =
    recurringEventFreqOptions.find(
      (option) =>
        option.freq === recurringEventState?.freq && option.interval === recurringEventState?.interval
    ) ?? recurringEventFreqOptions[1];

  const recurringLocked = { disabled: false };

  return (
    <div className={classNames("block items-start sm:flex", customClassNames?.container)}>
      <div className={!paymentEnabled ? "w-full" : ""}>
        {paymentEnabled ? (
          <Alert
            severity="warning"
            className={customClassNames?.paymentAlert}
            title={t("warning_payment_recurring_event")}
          />
        ) : (
          <>
            <Alert
              className={classNames("mb-4", customClassNames?.experimentalAlert)}
              severity="warning"
              title="Experimental: Recurring Events are currently experimental and causes some issues sometimes when checking for availability. We are working on fixing this."
            />
            <SettingsToggle
              labelClassName={classNames("text-sm", customClassNames?.recurringToggle?.label)}
              toggleSwitchAtTheEnd={true}
              switchContainerClassName={classNames(
                "border-subtle rounded-lg border py-6 px-4 sm:px-6",
                recurringEventState !== null && "rounded-b-none",
                customClassNames?.recurringToggle?.container
              )}
              childrenClassName={classNames("lg:ml-0", customClassNames?.recurringToggle?.children)}
              descriptionClassName={customClassNames?.recurringToggle?.description}
              title={t("recurring_event")}
              {...recurringLocked}
              description={
                <LearnMoreLink
                  t={t}
                  i18nKey="recurring_event_description"
                  href="https://cal.com/help/event-types/recurring-events"
                />
              }
              checked={!!recurringEventState}
              data-testid="recurring-event-check"
              disabled={(!recurringEventState && isSeatsOffered) || hasBookingLimitPerBooker}
              tooltip={
                isSeatsOffered
                  ? t("seats_doesnt_support_recurring")
                  : hasBookingLimitPerBooker
                    ? t("booking_limit_per_booker_doesnt_support_recurring")
                    : undefined
              }
              onCheckedChange={(e) => {
                if (!e) {
                  formMethods.setValue("recurringEvent", null, { shouldDirty: true });
                  setRecurringEventState(null);
                } else {
                  const newVal = eventType.recurringEvent || {
                    interval: 1,
                    count: 12,
                    freq: Frequency.WEEKLY,
                  };
                  formMethods.setValue("recurringEvent", newVal, { shouldDirty: true });
                  setRecurringEventState(newVal);
                }
              }}>
              <div className="rounded-b-lg border border-subtle border-t-0 p-6">
                {recurringEventState && (
                  <div data-testid="recurring-event-collapsible" className="text-sm">
                    <div className="flex items-center">
                      <p
                        className={classNames(
                          "text-emphasis ltr:mr-2 rtl:ml-2",
                          customClassNames?.frequencyInput?.label
                        )}>
                        {t("frequency")}
                      </p>
                      <Select
                        options={recurringEventFreqOptions}
                        value={selectedRecurringEventFreqOption}
                        isSearchable={false}
                        className={classNames(
                          "block w-32 min-w-0 rounded-md text-sm",
                          customClassNames?.frequencyUnitSelect?.select
                        )}
                        innerClassNames={customClassNames?.frequencyUnitSelect?.innerClassNames}
                        isDisabled={recurringLocked.disabled}
                        onChange={(event) => {
                          const [freq, interval] = (event?.value || `${Frequency.WEEKLY}:1`).split(":");
                          const newVal = {
                            ...recurringEventState,
                            freq: parseInt(freq, 10),
                            interval: parseInt(interval, 10),
                          };
                          formMethods.setValue("recurringEvent", newVal, { shouldDirty: true });
                          setRecurringEventState(newVal);
                        }}
                      />
                    </div>
                    <div
                      className={classNames(
                        "mt-4 flex items-center",
                        customClassNames?.maxEventsInput?.container
                      )}>
                      <p
                        className={classNames(
                          "text-emphasis ltr:mr-2 rtl:ml-2",
                          customClassNames?.maxEventsInput?.labelText
                        )}>
                        {t("number_of_repetitions")}
                      </p>
                      <TextField
                        disabled={recurringLocked.disabled}
                        type="number"
                        min="1"
                        max="24"
                        defaultValue={recurringEventState.count}
                        className={classNames("mb-0", customClassNames?.maxEventsInput?.countInput)}
                        onChange={(event) => {
                          const newVal = {
                            ...recurringEventState,
                            count: parseInt(event?.target.value, 10),
                          };
                          formMethods.setValue("recurringEvent", newVal, { shouldDirty: true });
                          setRecurringEventState(newVal);
                        }}
                      />
                      <p
                        className={classNames(
                          "text-emphasis ltr:ml-2 rtl:mr-2",
                          customClassNames?.maxEventsInput?.suffixText
                        )}>
                        {t("events", {
                          count: recurringEventState.count,
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </SettingsToggle>
          </>
        )}
      </div>
    </div>
  );
}
