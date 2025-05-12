    export function jsonAstWalk(ast) {
        /*  sanity check arguments  */
        if (typeof ast !== "object")
            throw new Error("generate: invalid AST argument (expected type object)")

        /*  walk the AST  */
        let json = ""
        ast.walk((node, depth, parent, when) => {
            if (when === "downward") {
                const prolog = node.get("prolog")
                if (prolog !== undefined)
                    json += prolog
                const body = node.get("body")
                if (body !== undefined)
                    json += body
                else {
                    const value = node.get("value")
                    if (value !== undefined)
                        json += JSON.stringify(value)
                }
            }
            else if (when === "upward") {
                const epilog = node.get("epilog")
                if (epilog !== undefined)
                    json += epilog
            }
        }, "both")
        console.log(json)
    }
