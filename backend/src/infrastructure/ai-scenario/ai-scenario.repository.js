import mongoose from 'mongoose';
import AiScenario from './ai-scenario.model.js';

const activeCondition = { isActive: { $ne: false } };

export async function findActiveByCode(code) {
    if (typeof code !== 'string') return null;
    return AiScenario.findOne({ code, ...activeCondition }).lean();
}

export async function findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return AiScenario.findById(id).lean();
}