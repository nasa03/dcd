import { Progress } from "@equinor/eds-core-react"
import { useAppConfig, useCurrentUser, useFusionEnvironment } from "@equinor/fusion"
import { ErrorBoundary } from "@equinor/fusion-components"
import { useAgGridStyles } from "@equinor/fusion-react-ag-grid-addons"
import ConceptAppAuthProvider from "../auth/ConceptAppAuthProvider"
import { buildConfig } from "../Services/config"
import { StoreAppId, StoreAppScope } from "../Utils/common"
import { APP_VERSION } from "../version"
import { AppRouter } from "./AppRouter"
import { FusionRouterBootstrap } from "./FusionRouterBootstrap"

const setEnvironment = (): void => {
    const fusionEnv = useFusionEnvironment()
    localStorage.setItem("FUSION_ENV_LOCAL_CACHE_KEY", fusionEnv.env)
}

/**
 * Renders the appropriate view based on user authentication and matching application routes.
 * @returns {*} {JSX.Element}
 */
function App(): JSX.Element {
    setEnvironment()
    useAgGridStyles()
    const user = useCurrentUser()
    const runtimeConfig = useAppConfig()
    if (runtimeConfig.value?.endpoints.REACT_APP_API_BASE_URL) {
        buildConfig(runtimeConfig.value!.endpoints.REACT_APP_API_BASE_URL)
    }

    if (runtimeConfig.value?.environment) {
        const values: any = { ...runtimeConfig.value.environment }
        StoreAppId(values.APP_ID)
        StoreAppScope(values.BACKEND_APP_SCOPE)
    }

    console.log("Concept App version: ", APP_VERSION)

    return (
        <ErrorBoundary>
            <ConceptAppAuthProvider>
                {(() => {
                    if (runtimeConfig.value?.endpoints.REACT_APP_API_BASE_URL === null
                        || runtimeConfig.value?.endpoints.REACT_APP_API_BASE_URL === undefined) {
                        return (
                            <>
                                <Progress.Circular size={16} color="primary" />
                                <p>Fetching Fusion app config</p>
                            </>
                        )
                    }

                    buildConfig(runtimeConfig.value!.endpoints.REACT_APP_API_BASE_URL)

                    return (
                        <FusionRouterBootstrap>
                            <AppRouter />
                        </FusionRouterBootstrap>
                    )
                })()}
            </ConceptAppAuthProvider>
        </ErrorBoundary>
    )
}

export default App
