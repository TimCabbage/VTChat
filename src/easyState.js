import { memo, useEffect, useMemo, useState } from "react";
import { observe, unobserve, observable } from '@nx-js/observer-util';

export function easyView(Comp) {
    let ReactiveComp;
    // use a hook based reactive wrapper when we can
    ReactiveComp = props => {
        // use a dummy setState to update the component
        const [, setState] = useState(); // create a memoized reactive wrapper of the original component (render)
        // at the very first run of the component function

        const render = useMemo(() => observe(Comp, {
            scheduler: () => { setState({}); },
            lazy: true
        }), // Adding the original Comp here is necessary to make React Hot Reload work
            // it does not affect behavior otherwise
            [Comp]); // cleanup the reactive connections after the very last render of the component

        useEffect(() => {
            return () => unobserve(render);
        }, []); // the isInsideFunctionComponent flag is used to toggle `store` behavior
        // based on where it was called from

        // run the reactive render instead of the original one
        return render({ ...props, something: Math.random() });
    }
    return memo(ReactiveComp);
}

export function easyStore(obj) {
    // useMemo is not a semantic guarantee
    // In the future, React may choose to “forget” some previously memoized values and recalculate them on next render
    // see this docs for more explanation: https://reactjs.org/docs/hooks-reference.html#usememo

    return observable(obj); // eslint-disable-line
}