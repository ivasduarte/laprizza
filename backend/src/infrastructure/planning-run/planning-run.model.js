import mongoose from 'mongoose';

const { Mixed } = mongoose.Schema.Types;

/** Saved version of a planning input used by a run: { id, name, version } (null if none). */
const inputVersionSchema = new mongoose.Schema(
  { id: String, name: String, version: Number },
  { _id: false },
);

/**
 * One planning execution (WEB07/AI05): the result of the Prolog AI service together with the
 * exact inputs it used, so a result keeps its meaning after forecasts or scenarios change.
 * Append-only: runs are never updated.
 */
const planningRunSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['bom', 'requirements'], required: true },
    request: {
      scenarioId: { type: String, required: true },
      stockMode: { type: String, enum: ['live', 'scenario'], required: true },
      forecastId: { type: String, default: null },
      supplierScenarioId: { type: String, default: null },
    },
    snapshotId: { type: String, default: null },
    scenario: { type: Mixed, default: null },
    forecast: { type: inputVersionSchema, default: null },
    supplierScenario: { type: inputVersionSchema, default: null },
    bomVersion: { type: String, default: null },
    stockSource: { type: Mixed, default: null },
    status: { type: String, required: true },
    result: { type: Mixed, required: true },
    requestedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

planningRunSchema.index({ createdAt: -1 });
planningRunSchema.index({ 'forecast.id': 1, createdAt: -1 });

export default mongoose.model('PlanningRun', planningRunSchema);
