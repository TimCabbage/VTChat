

export class TimedAccumulator {
    acc: number = 0;
    accAttenuated: number = 0;
    interval: number;

    lastTime: number = Date.now();
    value: number = 0;

    constructor(desiredInterval: number = 60) {
        this.interval = desiredInterval;
    }

    passTime() {
        const newTime = Date.now();
        const intervalsPassed = (newTime - this.lastTime) / (this.interval * 1000);
        this.value = this.accAttenuated / intervalsPassed;
        this.accAttenuated = this.accAttenuated - this.accAttenuated * intervalsPassed;
        if(this.accAttenuated < 0) this.accAttenuated = 0;
        this.lastTime = newTime;
    }

    add(amount: number) {
        this.acc += amount;
        this.accAttenuated += amount;
    }
}