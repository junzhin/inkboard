class ServerState {
    pendingQuestions = new Map();
    pendingPlanReviews = new Map();
    questionRoutingEnabled = false;
    counter = 0;
    nextId() {
        return `ink_${Date.now()}_${++this.counter}`;
    }
    addQuestion(id, questions, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingQuestions.delete(id);
                reject(new Error("timeout"));
            }, timeoutMs);
            this.pendingQuestions.set(id, {
                resolve,
                reject,
                timeout,
                questions,
                deadline: Date.now() + timeoutMs,
            });
        });
    }
    resolveQuestion(id, answers) {
        const pending = this.pendingQuestions.get(id);
        if (!pending)
            return false;
        clearTimeout(pending.timeout);
        this.pendingQuestions.delete(id);
        pending.resolve(answers);
        return true;
    }
    releaseQuestion(id) {
        const pending = this.pendingQuestions.get(id);
        if (!pending)
            return false;
        clearTimeout(pending.timeout);
        this.pendingQuestions.delete(id);
        pending.reject("released");
        return true;
    }
    addPlanReview(opts) {
        const { id, content, filePath, timeoutMs, sessionId, sessionName } = opts;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingPlanReviews.delete(id);
                reject(new Error("timeout"));
            }, timeoutMs);
            this.pendingPlanReviews.set(id, {
                resolve,
                reject,
                timeout,
                content,
                filePath,
                sessionId,
                sessionName,
                deadline: Date.now() + timeoutMs,
            });
        });
    }
    resolvePlanReview(id, decision) {
        const pending = this.pendingPlanReviews.get(id);
        if (!pending)
            return false;
        clearTimeout(pending.timeout);
        this.pendingPlanReviews.delete(id);
        pending.resolve(decision);
        return true;
    }
    reset() {
        for (const [, pending] of this.pendingQuestions) {
            clearTimeout(pending.timeout);
        }
        for (const [, pending] of this.pendingPlanReviews) {
            clearTimeout(pending.timeout);
        }
        this.pendingQuestions.clear();
        this.pendingPlanReviews.clear();
        this.counter = 0;
    }
}
export const state = new ServerState();
//# sourceMappingURL=state.js.map