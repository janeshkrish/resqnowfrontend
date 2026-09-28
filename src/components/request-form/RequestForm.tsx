import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import LocationStep from "@/components/service-request/LocationStep";
import type { ServiceRequestFormData } from "@/components/service-request/types";
import { serviceSpecFor, type Question } from "@/config/requestQuestions";
import { useAuth } from "@/contexts/AuthContext";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { useUnifiedServiceRequestFlow } from "@/hooks/useUnifiedServiceRequestFlow";
import { fetchEvStations, formatStationDistance } from "@/lib/evCharging";
import { fetchFuelStations } from "@/lib/fuelStations";
import { addVehicle, GARAGE_QUERY_KEY, listVehicles } from "@/lib/garage";
import { fetchFuelPrices, fetchServicePrices } from "@/lib/homeApi";
import {
  answerChips,
  buildRequestDetails,
  firstMissingAnswer,
  isQuestionShown,
  isUrgent,
  toggleAnswer,
  type Answers,
  type Attachment,
  type FormContext,
} from "@/lib/requestForm";
import { choiceFromGarage, displayName, garageForFamily, hasVehicle, vehicleWord, type VehicleChoice } from "@/lib/vehicleChoice";
import { isTwoWheeler, vehicleClassInfo, type VehicleFamily } from "@/lib/vehicleClasses";
import { cn } from "@/lib/utils";
import { ContactBlock, NotesBlock, PlateAndSave, RequestSummary } from "./ConfirmStep";
import QuestionField from "./QuestionField";
import SlideToSend from "./SlideToSend";
import VehiclePicker from "./VehiclePicker";

const SUPPORT_PHONE = "+919566510080";
const FAMILY_LABEL: Record<VehicleFamily, string> = { car: "Car", bike: "Bike", commercial: "Commercial vehicle", ev: "EV" };

type FormData = ServiceRequestFormData & VehicleChoice & {
  answers?: Answers;
  landmark?: string;
  note?: string;
  attachments?: Attachment[];
  saveToGarage?: boolean;
};

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const text = (value: unknown) => String(value ?? "").trim();
const hasPoint = (lat: unknown, lng: unknown) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && !(Number(lat) === 0 && Number(lng) === 0);

export default function RequestForm({ family }: { family: VehicleFamily }) {
  const { serviceId = "" } = useParams();
  const spec = serviceSpecFor(serviceId);
  const isSos = spec.key === "sos";
  const isTowing = spec.key === "towing";
  const word = vehicleWord(family);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, updateProfile } = useAuth();
  const [mediaBusy, setMediaBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const garageQuery = useQuery({ queryKey: GARAGE_QUERY_KEY, queryFn: listVehicles, staleTime: 60_000 });
  const garage = useMemo(() => garageForFamily(garageQuery.data ?? [], family), [family, garageQuery.data]);

  const missingOnStep1 = (data: FormData): string | null => {
    const answers = data.answers ?? {};
    const context: FormContext = { family, classId: data.vehicleSubtype };
    if (isSos) return firstMissingAnswer(spec, answers, context);
    const first = firstMissingAnswer(spec, answers, context, { firstOnly: true });
    if (first) return first;
    if (!hasVehicle(data)) return `your ${word}`;
    if (!data.vehicleSubtype) return family === "car" ? "the car size" : "the type";
    return firstMissingAnswer(spec, answers, context);
  };

  const saveToGarage = async (data: FormData) => {
    const type = isTwoWheeler(family, data.vehicleSubtype) ? "bike" : "car";
    if (!data.saveToGarage || family === "commercial" || data.vehicleSource === "garage" || !hasVehicle(data)) return;
    const name = text(data.vehicleModel);
    // A typed name ("Opel Astra") has no brand of its own: its first word stands in.
    const make = text(data.vehicleBrand) || name.split(" ")[0];
    const brandPrefix = new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
    const model = name.replace(brandPrefix, "") || name;
    await addVehicle({ type, make, model, license_plate: text(data.plate) });
    await queryClient.invalidateQueries({ queryKey: GARAGE_QUERY_KEY });
  };

  const flow = useUnifiedServiceRequestFlow({
    serviceId,
    vehicleType: family,
    storageKey: `resqnow_service_request_${serviceId}_${family}`,
    resetRequested: Boolean((location.state as { reset?: boolean } | null)?.reset),
    user,
    updateProfile,
    navigate,
    createInitialFormData: (techId) => ({
      vehicleType: family,
      vehicleSubtype: "",
      vehicleModel: "",
      vehicleBrand: "",
      location: "",
      dropLocation: "",
      name: "",
      phone: "",
      email: "",
      details: "",
      selectedTechnicianId: techId || null,
      answers: {},
      landmark: "",
      note: "",
      attachments: [],
      plate: "",
      saveToGarage: true,
    }),
    validateStep1: (data) => !missingOnStep1(data as FormData),
    buildVehicleModel: (data) => text(data.vehicleModel),
    buildDescription: () => "",
    buildRequestExtras: (raw) => {
      const data = raw as FormData;
      return {
        vehicle_brand: text(data.vehicleBrand) || null,
        vehicle_subtype: text(data.vehicleSubtype) || null,
        details: buildRequestDetails({
          spec,
          answers: data.answers ?? {},
          context: { family, classId: data.vehicleSubtype },
          landmark: data.landmark,
          plate: data.plate,
          note: data.note,
          attachments: data.attachments,
        }),
      };
    },
    buildEstimateExtras: (raw) => {
      const data = raw as FormData;
      return {
        vehicleBrand: text(data.vehicleBrand) || null,
        vehicleSubtype: text(data.vehicleSubtype) || null,
        canRoll: typeof data.answers?.roll === "string" ? data.answers.roll : null,
      };
    },
    onSubmitted: (data) => saveToGarage(data as FormData),
    successTitle: isSos ? "Help is on the way" : "Finding a technician near you",
    successDescription: spec.tip,
  });

  const { currentStep, isSubmitting, setFormData } = flow;
  const formData = flow.formData as FormData;
  const setForm = useCallback(
    (patch: Partial<FormData>) => setFormData((previous: ServiceRequestFormData) => ({ ...previous, ...patch })),
    [setFormData],
  );
  const answers = formData.answers ?? {};
  const context: FormContext = { family, classId: formData.vehicleSubtype };

  // Contact details from the account, once.
  useEffect(() => {
    if (!user) return;
    setFormData((previous: ServiceRequestFormData) => ({
      ...previous,
      name: previous.name || user.name || "",
      phone: previous.phone || String(user.phone || "").replace(/\D/g, "").slice(-10),
    }));
  }, [setFormData, user]);

  // "Get help for this car" from My garage: that vehicle comes pre-picked.
  const preselectDone = useRef(false);
  useEffect(() => {
    const wanted = Number(searchParams.get("vehicle"));
    if (preselectDone.current || !wanted || !garage.length) return;
    preselectDone.current = true;
    const vehicle = garage.find((entry) => entry.id === wanted);
    if (vehicle) setForm(choiceFromGarage(vehicle, family));
  }, [family, garage, searchParams, setForm]);

  // Nothing picked yet and there are saved vehicles: start on My garage.
  const pristineVehicle = !formData.vehicleTab && !hasVehicle(formData);
  useEffect(() => {
    if (garage.length && pristineVehicle) setForm({ vehicleTab: "garage" });
  }, [garage.length, pristineVehicle, setForm]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [currentStep]);

  // ---------------------------------------------------------------- prices and places nearby
  const pricingConfig = usePricingConfig();
  const servicePrices = useQuery({
    queryKey: ["home", "service-prices", family],
    queryFn: ({ signal }) => fetchServicePrices(family, signal),
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const configPrice = Number(pricingConfig.data?.service_base_prices?.[spec.key]?.[family]) || null;
  const startingPrice = servicePrices.data?.services.find((entry) => entry.service === spec.key)?.startingPrice ?? configPrice;

  const pickupPoint = hasPoint(formData.locationLat, formData.locationLng)
    ? { lat: Number(Number(formData.locationLat).toFixed(3)), lng: Number(Number(formData.locationLng).toFixed(3)) }
    : null;
  const fuelPrices = useQuery({
    queryKey: ["request", "fuel-prices", pickupPoint?.lat, pickupPoint?.lng],
    queryFn: ({ signal }) => fetchFuelPrices(pickupPoint!, signal),
    enabled: spec.key === "fuel" && Boolean(pickupPoint),
    staleTime: 30 * 60_000,
    retry: 0,
  });
  const nearestPump = useQuery({
    queryKey: ["request", "nearest-pump", pickupPoint?.lat, pickupPoint?.lng],
    queryFn: ({ signal }) => fetchFuelStations(pickupPoint!, undefined, signal),
    enabled: spec.key === "fuel" && Boolean(pickupPoint),
    staleTime: 10 * 60_000,
    retry: 0,
  });
  const nearestCharger = useQuery({
    queryKey: ["request", "nearest-charger", pickupPoint?.lat, pickupPoint?.lng],
    queryFn: ({ signal }) => fetchEvStations(pickupPoint!, undefined, signal),
    enabled: spec.key === "ev-charging" && Boolean(pickupPoint) && currentStep === 2,
    staleTime: 10 * 60_000,
    retry: 0,
  });
  const fuelKind = answers.fuel === "diesel" ? "diesel" : "petrol";
  const fuelPrice = fuelPrices.data?.available ? fuelPrices.data.prices?.find((entry) => entry.fuel === fuelKind)?.price ?? null : null;
  const pumpDistance = (nearestPump.data?.stations ?? [])
    .map((station) => station.distance)
    .filter((distance): distance is number => Number.isFinite(distance))
    .sort((a, b) => a - b)[0];
  const charger = [...(nearestCharger.data?.stations ?? [])]
    .filter((station) => Number.isFinite(station.distance))
    .sort((a, b) => Number(a.distance) - Number(b.distance))[0];

  // ---------------------------------------------------------------- towing fare
  const estimateQuote = flow.towingEstimate?.quote || flow.towingEstimate;
  const fareTotal = Number(estimateQuote?.final_estimated_price ?? flow.towingEstimate?.finalEstimatedPrice);
  const fareReady = isTowing && Number.isFinite(fareTotal) && fareTotal > 0 && !flow.towingEstimateError;
  const litres = Number(answers.qty || 0);
  const fuelTotal = fuelPrice && litres && startingPrice ? litres * fuelPrice + startingPrice : null;

  // ---------------------------------------------------------------- the dock
  const missing = currentStep === 1 ? missingOnStep1(formData) : null;
  const stepTwoReady = currentStep === 2 ? flow.canProceed() : true;
  let dockIcon = "payments";
  let dockText = startingPrice ? `Starts from ${rupees(startingPrice)} · you pay after the work is done` : "You pay after the work is done";
  if (spec.key === "mechanical" && startingPrice) dockText = `Inspection from ${rupees(startingPrice)} · repair cost told first`;
  if (spec.key === "battery" && answers.need === "new" && startingPrice) dockText = `Starts from ${rupees(startingPrice)} + battery cost`;
  if (spec.key === "winching" && answers.upright === "no" && startingPrice) dockText = `Starts from ${rupees(startingPrice)} · crane costs extra`;
  if (spec.key === "fuel") dockText = answers.fuel === "cng" ? "CNG can’t be delivered · try towing" : fuelTotal ? `About ${rupees(fuelTotal)} · today’s fuel price` : dockText;
  if (isTowing) {
    dockIcon = "local_shipping";
    dockText = fareReady
      ? `About ${rupees(fareTotal)} · pay after the drop`
      : currentStep === 1 && !(hasVehicle(formData) && formData.vehicleSubtype)
        ? `Choose your ${word} to see the fare`
        : "Fare shows once pick up and drop are set";
  }
  if (isSos) { dockIcon = "support_agent"; dockText = "No payment now · we’ll call you to confirm"; }
  if (currentStep === 2 && !isTowing && !isSos) { dockIcon = "location_on"; dockText = "Help comes to this spot"; }
  if (missing) { dockIcon = "info"; dockText = "Answer above to continue"; }

  const stepTwoNeed = !text(formData.location)
    ? (isTowing ? "Choose where to pick up" : "Choose your location")
    : isTowing && !text(formData.dropLocation) ? "Choose where to take it"
    : isTowing && flow.isEstimatingTowing ? "Working out the fare…"
    : isTowing ? "Waiting for the fare" : "Choose your location";
  const ctaLabel = missing ? `Choose ${missing}` : currentStep === 2 && !stepTwoReady ? stepTwoNeed : "Continue";
  const ctaOff = Boolean(missing) || !stepTwoReady;

  const onContinue = () => {
    if (ctaOff) {
      toast.message(ctaLabel);
      return;
    }
    void flow.handleNext();
  };

  const onSend = () => {
    if (mediaBusy) {
      toast.message("Wait a moment", { description: "Your photo or voice note is still uploading." });
      return false;
    }
    if (!flow.canProceed()) {
      toast.error("Add your name and 10-digit mobile number");
      return false;
    }
    void flow.submitRequest();
    return true;
  };

  const onPick = (question: Question, value: string) => {
    const next = toggleAnswer(answers, question, value);
    // Hidden follow-ups lose their answer (e.g. litres once CNG is picked).
    for (const entry of spec.questions) {
      if (!isQuestionShown(entry, next, context)) delete next[entry.id];
    }
    setForm({ answers: next });
  };

  const switchTo = (service: "towing") => {
    const draftKey = `resqnow_service_request_${service}_${family}`;
    const vehicle: VehicleChoice = {
      vehicleTab: formData.vehicleTab, vehicleSource: formData.vehicleSource, garageVehicleId: formData.garageVehicleId,
      catalogBrandId: formData.catalogBrandId, catalogModelId: formData.catalogModelId, manualName: formData.manualName,
      vehicleBrand: formData.vehicleBrand, vehicleModel: formData.vehicleModel, vehicleSubtype: formData.vehicleSubtype, plate: formData.plate,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        currentStep: 1,
        formData: {
          ...formData, ...vehicle, answers: {}, dropLocation: "", dropLat: undefined, dropLng: undefined,
          dropLocationCoordinates: undefined, dropPlace: null, dropPlaceId: null,
        },
      }));
    } catch {
      // Private mode: the towing form starts empty instead.
    }
    navigate(`/request-service/${service}/${family}`);
  };

  const goToStep = (step: number) => {
    if (step >= currentStep) return;
    flow.setCurrentStep(step);
    window.history.replaceState({ serviceStep: step }, "");
  };

  const onBack = () => {
    if (currentStep > 1) flow.handleBack();
    else navigate(`/request-service/${serviceId}`);
  };

  // ---------------------------------------------------------------- summary bits
  const classInfo = vehicleClassInfo(formData.vehicleSubtype);
  const vehicleLine = hasVehicle(formData)
    ? [displayName(formData), classInfo?.label].filter(Boolean).join(" · ")
    : isSos ? "Vehicle not added" : "Vehicle not chosen";
  const chips = answerChips(spec, answers, context);
  let priceLabel = "Starts from";
  let priceValue = startingPrice ? rupees(startingPrice) : "Told before work starts";
  if (isSos) { priceLabel = "Payment"; priceValue = "Nothing now"; }
  if (isTowing) { priceLabel = "Fare estimate"; priceValue = fareReady ? rupees(fareTotal) : "—"; }
  if (spec.key === "mechanical") priceLabel = "Inspection from";
  if (spec.key === "fuel" && fuelTotal) { priceLabel = "You pay about"; priceValue = rupees(fuelTotal); }
  const urgent = isUrgent(answers);
  const stepNames = isSos ? ["What happened", "Location", "Confirm"] : ["Vehicle & problem", "Location", "Confirm"];
  const vehicleStep = isSos ? 3 : 1;
  const firstQuestions = spec.questions.filter((question) => question.first);
  const otherQuestions = spec.questions.filter((question) => !question.first);
  const renderQuestion = (question: Question) =>
    isQuestionShown(question, answers, context) ? (
      <QuestionField
        key={question.id}
        question={question}
        context={context}
        answers={answers}
        onPick={onPick}
        onSwitch={switchTo}
        fuel={{ pricePerLitre: fuelPrice, area: fuelPrices.data?.location?.area ?? null, serviceFee: startingPrice }}
      />
    ) : null;
  const vehicleName = displayName(formData) || word;
  const showPlate = !isSos && formData.vehicleSource !== "garage" && hasVehicle(formData);
  const canSave = showPlate && family !== "commercial";

  return (
    <div className="rqf-page">
      <div className="rqf" ref={scrollRef}>
        <div className="rqf-head">
          <header className="rqf-top">
            <button type="button" className="rqf-icon-btn rq-press" aria-label={currentStep > 1 ? "Back to the previous step" : "Back"} onClick={onBack}>
              <MaterialSymbol name="arrow_back" />
            </button>
            <div className="rqf-top-id">
              <h1>{spec.title}{urgent ? <span className="rqf-urgent"><MaterialSymbol name="emergency" />Urgent</span> : null}</h1>
              <small>{FAMILY_LABEL[family]} · Step {currentStep} of 3</small>
            </div>
            <a className="rqf-help-btn rq-press" href={`tel:${SUPPORT_PHONE}`}><MaterialSymbol name="support_agent" />Call us</a>
          </header>
          <ol className="rqf-steps" aria-label={`Step ${currentStep} of 3`}>
            {stepNames.map((name, index) => {
              const step = index + 1;
              return (
                <li key={name} className={cn("rqf-step", step === currentStep && "on", step < currentStep && "done")} aria-current={step === currentStep ? "step" : undefined}>
                  <span className="rqf-bar" />
                  <span className="rqf-step-lbl">{step < currentStep ? <MaterialSymbol name="check_circle" /> : null}{name}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rqf-body">
          {currentStep === 1 ? (
            isSos ? (
              spec.questions.map(renderQuestion)
            ) : (
              <>
                {firstQuestions.map(renderQuestion)}
                <VehiclePicker
                  family={family}
                  choice={formData}
                  garage={garage}
                  onChange={(patch) => setForm(patch)}
                  classSetsPrice={isTowing}
                />
                {otherQuestions.map(renderQuestion)}
              </>
            )
          ) : null}

          {currentStep === 2 ? (
            <>
              <LocationStep
                formData={formData}
                onInputChange={flow.handleInputChange}
                currentLocation={flow.currentLocation}
                isGettingLocation={flow.loadingGeo}
                onGetCurrentLocation={flow.handleGetCurrentLocation}
                onLocationSelect={flow.handleLocationSelect}
                requiresDropLocation={flow.requiresDropLocation}
                onDropLocationSelect={flow.handleDropLocationSelect}
                onGetCurrentDropLocation={flow.handleGetCurrentDropLocation}
                towingEstimate={flow.towingEstimate}
                isEstimatingTowing={flow.isEstimatingTowing}
                towingEstimateError={flow.towingEstimateError}
                towingEstimateWarning={flow.towingEstimateWarning}
                emergency={isSos}
              />
              {spec.key === "ev-charging" && charger ? (
                <div className="rqf-sec">
                  <div className="rqf-near">
                    <span className="rqf-near-ic"><MaterialSymbol name="ev_station" /></span>
                    <span className="rqf-near-id"><small>Nearest charger · {formatStationDistance(charger.distance)}</small><b>{charger.name}</b></span>
                  </div>
                  <p className="rqf-note">If you pick “Tow to a charger”, the helper can take you here.</p>
                </div>
              ) : null}
              {spec.key === "fuel" && Number.isFinite(pumpDistance) ? (
                <p className="rqf-note rqf-sec">Nearest pump is {formatStationDistance(pumpDistance)} away. Enough fuel to reach it is usually all you need.</p>
              ) : null}
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <RequestSummary
                spec={spec}
                vehicleLine={vehicleLine}
                chips={chips}
                pickup={text(formData.location)}
                drop={isTowing ? text(formData.dropLocation) : null}
                priceLabel={priceLabel}
                priceValue={priceValue}
                onEditVehicle={() => goToStep(vehicleStep)}
                onEditProblem={() => goToStep(1)}
                onEditLocation={() => goToStep(2)}
              />
              {isSos ? (
                <VehiclePicker family={family} choice={formData} garage={garage} onChange={(patch) => setForm(patch)} showClasses={false} />
              ) : null}
              {showPlate ? (
                <PlateAndSave
                  plate={text(formData.plate)}
                  onPlate={(plate) => setForm({ plate })}
                  canSave={canSave}
                  save={formData.saveToGarage !== false}
                  onSave={(saveToGarage) => setForm({ saveToGarage })}
                  vehicleName={vehicleName}
                />
              ) : null}
              <ContactBlock
                contact={{ name: String(formData.name || ""), phone: String(formData.phone || ""), email: String(formData.email || "") }}
                onChange={(patch) => setForm(patch)}
              />
              {!isSos ? (
                <NotesBlock
                  note={String(formData.note || "")}
                  onNote={(note) => setForm({ note })}
                  attachments={formData.attachments ?? []}
                  onAttachments={(attachments) => setForm({ attachments })}
                  onBusy={setMediaBusy}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="rqf-dock">
        <p className="rqf-dock-sum"><MaterialSymbol name={dockIcon} />{dockText}</p>
        {currentStep < 3 ? (
          <button type="button" className={cn("rqf-cta rq-press", ctaOff && "is-off")} aria-disabled={ctaOff} onClick={onContinue} disabled={isSubmitting}>
            {ctaLabel}<MaterialSymbol name={ctaOff ? "lock" : "arrow_forward"} />
          </button>
        ) : (
          <SlideToSend
            text={isSos ? "Slide to send help" : urgent ? "Slide to send urgent help" : "Slide to find technician"}
            urgent={isSos || urgent}
            busy={isSubmitting}
            onSend={onSend}
          />
        )}
      </div>
    </div>
  );
}
