import {
    Dispatch,
    SetStateAction,
    ChangeEventHandler,
    useState,
    useEffect,
    useRef,
} from "react"
import styled from "styled-components"

import {
    Button, NativeSelect, Progress, Typography,
} from "@equinor/eds-core-react"
import { Project } from "../../models/Project"
import { Case } from "../../models/case/Case"
import CaseNumberInput from "../../Components/Case/CaseNumberInput"
import { DrainageStrategy } from "../../models/assets/drainagestrategy/DrainageStrategy"
import CaseTabTable from "./CaseTabTable"
import { NetSalesGas } from "../../models/assets/drainagestrategy/NetSalesGas"
import { FuelFlaringAndLosses } from "../../models/assets/drainagestrategy/FuelFlaringAndLosses"
import { ProductionProfileGas } from "../../models/assets/drainagestrategy/ProductionProfileGas"
import { ProductionProfileOil } from "../../models/assets/drainagestrategy/ProductionProfileOil"
import { ProductionProfileWater } from "../../models/assets/drainagestrategy/ProductionProfileWater"
import { ProductionProfileNGL } from "../../models/assets/drainagestrategy/ProductionProfileNGL"
import { ProductionProfileWaterInjection } from "../../models/assets/drainagestrategy/ProductionProfileWaterInjection"
import { ITimeSeries } from "../../models/ITimeSeries"
import { SetTableYearsFromProfiles } from "./CaseTabTableHelper"
import { ImportedElectricity } from "../../models/assets/drainagestrategy/ImportedElectricity"
import { AgChartsTimeseries, setValueToCorrespondingYear } from "../../Components/AgGrid/AgChartsTimeseries"
import { ImportedElectricityOverride } from "../../models/assets/drainagestrategy/ImportedElectricityOverride"
import { NetSalesGasOverride } from "../../models/assets/drainagestrategy/NetSalesGasOverride"
import { FuelFlaringAndLossesOverride } from "../../models/assets/drainagestrategy/FuelFlaringAndLossesOverride"

const ColumnWrapper = styled.div`
    display: flex;
    flex-direction: column;
`
const RowWrapper = styled.div`
    display: flex;
    flex-direction: row;
    margin-bottom: 78px;
`
const TopWrapper = styled.div`
    display: flex;
    flex-direction: row;
    margin-top: 20px;
    margin-bottom: 20px;
`
const PageTitle = styled(Typography)`
    flex-grow: 1;
`
const NativeSelectField = styled(NativeSelect)`
    width: 200px;
    padding-right: 20px;
`
const NumberInputField = styled.div`
    padding-right: 20px;
`

const TableYearWrapper = styled.div`
    align-items: flex-end;
    display: flex;
    flex-direction: row;
    align-content: right;
    margin-left: auto;
    margin-bottom: 20px;
`
const YearInputWrapper = styled.div`
    width: 80px;
    padding-right: 10px;
`
const YearDashWrapper = styled.div`
    padding-right: 5px;
`
const InputWrapper = styled.div`
    margin-right: 20px;
`

interface Props {
    project: Project,
    setProject: Dispatch<SetStateAction<Project | undefined>>,
    caseItem: Case,
    setCase: Dispatch<SetStateAction<Case | undefined>>,
    drainageStrategy: DrainageStrategy,
    setDrainageStrategy: Dispatch<SetStateAction<DrainageStrategy | undefined>>,
    activeTab: number

    netSalesGas: NetSalesGas | undefined,
    setNetSalesGas: Dispatch<SetStateAction<NetSalesGas | undefined>>,

    fuelFlaringAndLosses: FuelFlaringAndLosses | undefined,
    setFuelFlaringAndLosses: Dispatch<SetStateAction<FuelFlaringAndLosses | undefined>>,

    importedElectricity: ImportedElectricity | undefined,
    setImportedElectricity: Dispatch<SetStateAction<ImportedElectricity | undefined>>,
}

function CaseProductionProfilesTab({
    project, setProject,
    caseItem, setCase,
    drainageStrategy, setDrainageStrategy,
    activeTab,
    netSalesGas, setNetSalesGas,
    fuelFlaringAndLosses, setFuelFlaringAndLosses,
    importedElectricity, setImportedElectricity,
}: Props) {
    const [gas, setGas] = useState<ProductionProfileGas>()
    const [oil, setOil] = useState<ProductionProfileOil>()
    const [water, setWater] = useState<ProductionProfileWater>()
    const [nGL, setNGL] = useState<ProductionProfileNGL>()
    const [waterInjection, setWaterInjection] = useState<ProductionProfileWaterInjection>()

    const [netSalesGasOverride, setNetSalesGasOverride] = useState<NetSalesGasOverride>()
    const [fuelFlaringAndLossesOverride, setFuelFlaringAndLossesOverride] = useState<FuelFlaringAndLossesOverride>()
    const [importedElectricityOverride, setImportedElectricityOverride] = useState<ImportedElectricityOverride>()

    const [startYear, setStartYear] = useState<number>(2020)
    const [endYear, setEndYear] = useState<number>(2030)
    const [tableYears, setTableYears] = useState<[number, number]>([2020, 2030])

    const gridRef = useRef<any>(null)

    const updateAndSetDraiangeStrategy = (drainage: DrainageStrategy) => {
        const newDrainageStrategy: DrainageStrategy = { ...drainage }
        newDrainageStrategy.netSalesGas = netSalesGas
        newDrainageStrategy.netSalesGasOverride = netSalesGasOverride
        newDrainageStrategy.fuelFlaringAndLosses = fuelFlaringAndLosses
        newDrainageStrategy.fuelFlaringAndLossesOverride = fuelFlaringAndLossesOverride
        newDrainageStrategy.productionProfileGas = gas
        newDrainageStrategy.productionProfileOil = oil
        newDrainageStrategy.productionProfileWater = water
        newDrainageStrategy.productionProfileNGL = nGL
        newDrainageStrategy.productionProfileWaterInjection = waterInjection

        newDrainageStrategy.importedElectricityOverride = importedElectricityOverride
        setDrainageStrategy(newDrainageStrategy)
    }

    const handleCaseFacilitiesAvailabilityChange: ChangeEventHandler<HTMLInputElement> = async (e) => {
        const newCase: Case = { ...caseItem }
        const newfacilitiesAvailability = e.currentTarget.value.length > 0
            ? Math.min(Math.max(Number(e.currentTarget.value), 0), 100) : undefined
        if (newfacilitiesAvailability !== undefined) {
            newCase.facilitiesAvailability = newfacilitiesAvailability / 100
        } else { newCase.facilitiesAvailability = undefined }
        setCase(newCase)
    }

    const handleDrainageStrategyGasSolutionChange: ChangeEventHandler<HTMLSelectElement> = async (e) => {
        if ([0, 1].indexOf(Number(e.currentTarget.value)) !== -1) {
            // eslint-disable-next-line max-len
            const newGasSolution: Components.Schemas.GasSolution = Number(e.currentTarget.value) as Components.Schemas.GasSolution
            const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
            newDrainageStrategy.gasSolution = newGasSolution
            updateAndSetDraiangeStrategy(newDrainageStrategy)
        }
    }

    const handleStartYearChange: ChangeEventHandler<HTMLInputElement> = async (e) => {
        const newStartYear = Number(e.currentTarget.value)
        if (newStartYear < 2010) {
            setStartYear(2010)
            return
        }
        setStartYear(newStartYear)
    }

    const handleEndYearChange: ChangeEventHandler<HTMLInputElement> = async (e) => {
        const newEndYear = Number(e.currentTarget.value)
        if (newEndYear > 2100) {
            setEndYear(2100)
            return
        }
        setEndYear(newEndYear)
    }

    interface ITimeSeriesData {
        profileName: string
        unit: string,
        set?: Dispatch<SetStateAction<ITimeSeries | undefined>>,
        overrideProfileSet?: Dispatch<SetStateAction<ITimeSeries | undefined>>,
        profile: ITimeSeries | undefined
        overrideProfile?: ITimeSeries | undefined
        overridable?: boolean
    }

    const timeSeriesData: ITimeSeriesData[] = [
        {
            profileName: "Oil production",
            unit: `${project?.physUnit === 0 ? "MSm³/yr" : "mill bbls/yr"}`,
            set: setOil,
            profile: oil,
        },
        {
            profileName: "Gas production",
            unit: `${project?.physUnit === 0 ? "GSm³/yr" : "Bscf/yr"}`,
            set: setGas,
            profile: gas,
        },
        {
            profileName: "Water production",
            unit: `${project?.physUnit === 0 ? "MSm³/yr" : "mill bbls/yr"}`,
            set: setWater,
            profile: water,
        },
        {
            profileName: "Water injection",
            unit: `${project?.physUnit === 0 ? "MSm³/yr" : "mill bbls/yr"}`,
            set: setWaterInjection,
            profile: waterInjection,
        },
        {
            profileName: "Fuel, flaring and losses",
            unit: `${project?.physUnit === 0 ? "GSm³/yr" : "Bscf/yr"}`,
            profile: fuelFlaringAndLosses,
            overridable: true,
            overrideProfile: fuelFlaringAndLossesOverride,
            overrideProfileSet: setFuelFlaringAndLossesOverride,
        },
        {
            profileName: "Net sales gas",
            unit: `${project?.physUnit === 0 ? "GSm³/yr" : "Bscf/yr"}`,
            profile: netSalesGas,
            overridable: true,
            overrideProfile: netSalesGasOverride,
            overrideProfileSet: setNetSalesGasOverride,
        },
        {
            profileName: "Imported electricity",
            unit: "GWh",
            profile: importedElectricity,
            overridable: true,
            overrideProfile: importedElectricityOverride,
            overrideProfileSet: setImportedElectricityOverride,
        },
    ]

    const handleTableYearsClick = () => {
        setTableYears([startYear, endYear])
    }

    const productionProfilesChartData = () => {
        const dataArray: object[] = []
        for (let i = startYear; i <= endYear; i += 1) {
            dataArray.push({
                year: i,
                oilProduction: setValueToCorrespondingYear(oil, i, startYear, caseItem.DG4Date.getFullYear()),
                gasProduction: setValueToCorrespondingYear(gas, i, startYear, caseItem.DG4Date.getFullYear()),
                waterProduction: setValueToCorrespondingYear(water, i, startYear, caseItem.DG4Date.getFullYear()),
            })
        }
        return dataArray
    }

    const injectionProfilesChartData = () => {
        const dataArray = []
        for (let i = startYear; i <= endYear; i += 1) {
            dataArray.push({
                year: i,
                waterInjection:
                    setValueToCorrespondingYear(waterInjection, i, startYear, caseItem.DG4Date.getFullYear()),
            })
        }
        return dataArray
    }

    useEffect(() => {
        (async () => {
            try {
                if (activeTab === 1) {
                    setFuelFlaringAndLosses(drainageStrategy.fuelFlaringAndLosses)
                    setNetSalesGas(drainageStrategy.netSalesGas)
                    setImportedElectricity(drainageStrategy.importedElectricity)

                    SetTableYearsFromProfiles([drainageStrategy.netSalesGas, drainageStrategy.fuelFlaringAndLosses,
                    drainageStrategy.netSalesGasOverride, drainageStrategy.fuelFlaringAndLossesOverride,
                    drainageStrategy.productionProfileGas, drainageStrategy.productionProfileOil,
                    drainageStrategy.productionProfileWater, drainageStrategy.productionProfileNGL,
                    drainageStrategy.productionProfileWaterInjection, drainageStrategy.importedElectricityOverride,
                    drainageStrategy.co2EmissionsOverride,
                    ], caseItem.DG4Date.getFullYear(), setStartYear, setEndYear, setTableYears)
                    setGas(drainageStrategy.productionProfileGas)
                    setOil(drainageStrategy.productionProfileOil)
                    setWater(drainageStrategy.productionProfileWater)
                    setNGL(drainageStrategy.productionProfileNGL)
                    setWaterInjection(drainageStrategy.productionProfileWaterInjection)

                    setImportedElectricityOverride(drainageStrategy.importedElectricityOverride)
                    setNetSalesGasOverride(drainageStrategy.netSalesGasOverride)
                    setFuelFlaringAndLossesOverride(drainageStrategy.fuelFlaringAndLossesOverride)
                }
            } catch (error) {
                console.error("[CaseView] Error while generating cost profile", error)
            }
        })()
    }, [activeTab])

    useEffect(() => {
        const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
        if (newDrainageStrategy.productionProfileOil && !oil) { return }
        newDrainageStrategy.productionProfileOil = oil
        setDrainageStrategy(newDrainageStrategy)
    }, [oil])

    useEffect(() => {
        const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
        if (newDrainageStrategy.productionProfileGas && !gas) { return }
        newDrainageStrategy.productionProfileGas = gas
        setDrainageStrategy(newDrainageStrategy)
    }, [gas])

    useEffect(() => {
        const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
        if (newDrainageStrategy.productionProfileWater && !water) { return }
        newDrainageStrategy.productionProfileWater = water
        setDrainageStrategy(newDrainageStrategy)
    }, [water])

    useEffect(() => {
        const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
        if (newDrainageStrategy.productionProfileWaterInjection && !waterInjection) { return }
        newDrainageStrategy.productionProfileWaterInjection = waterInjection
        setDrainageStrategy(newDrainageStrategy)
    }, [waterInjection])

    useEffect(() => {
        const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
        if (newDrainageStrategy.importedElectricityOverride && !importedElectricityOverride) { return }
        newDrainageStrategy.importedElectricityOverride = importedElectricityOverride
        setDrainageStrategy(newDrainageStrategy)
    }, [importedElectricityOverride])

    useEffect(() => {
        const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
        if (newDrainageStrategy.fuelFlaringAndLossesOverride && !fuelFlaringAndLossesOverride) { return }
        newDrainageStrategy.fuelFlaringAndLossesOverride = fuelFlaringAndLossesOverride
        setDrainageStrategy(newDrainageStrategy)
    }, [fuelFlaringAndLossesOverride])

    useEffect(() => {
        const newDrainageStrategy: DrainageStrategy = { ...drainageStrategy }
        if (newDrainageStrategy.netSalesGasOverride && !netSalesGasOverride) { return }
        newDrainageStrategy.netSalesGasOverride = netSalesGasOverride
        setDrainageStrategy(newDrainageStrategy)
    }, [netSalesGasOverride])

    useEffect(() => {
        if (gridRef.current && gridRef.current.api && gridRef.current.api.refreshCells) {
            gridRef.current.api.refreshCells()
        }
    }, [fuelFlaringAndLosses, netSalesGas, importedElectricity])

    if (activeTab !== 1) { return null }

    return (
        <>
            <TopWrapper>
                <PageTitle variant="h3">Production profiles</PageTitle>
            </TopWrapper>
            <ColumnWrapper>
                <RowWrapper>
                    <NumberInputField>
                        <CaseNumberInput
                            onChange={handleCaseFacilitiesAvailabilityChange}
                            defaultValue={caseItem.facilitiesAvailability
                                !== undefined ? caseItem.facilitiesAvailability * 100 : undefined}
                            integer={false}
                            label="Facilities availability"
                            unit="%"
                        />
                    </NumberInputField>
                    <NativeSelectField
                        id="gasSolution"
                        label="Gas solution"
                        onChange={handleDrainageStrategyGasSolutionChange}
                        value={drainageStrategy?.gasSolution}
                    >
                        <option key={0} value={0}>Export</option>
                        <option key={1} value={1}>Injection</option>
                    </NativeSelectField>
                    <InputWrapper>
                        <NativeSelectField
                            id="productionStrategy"
                            label="Production strategy overview"
                            onChange={() => { }}
                            disabled
                            value={caseItem.productionStrategyOverview}
                        >
                            <option key={0} value={0}>Depletion</option>
                            <option key={1} value={1}>Water injection</option>
                            <option key={2} value={2}>Gas injection</option>
                            <option key={3} value={3}>WAG</option>
                            <option key={4} value={4}>Mixed</option>
                        </NativeSelectField>
                    </InputWrapper>
                    <InputWrapper>
                        <NativeSelectField
                            id="artificialLift"
                            label="Artificial lift"
                            onChange={() => { }}
                            disabled
                            value={caseItem.artificialLift}
                        >
                            <option key="0" value={0}>No lift</option>
                            <option key="1" value={1}>Gas lift</option>
                            <option key="2" value={2}>Electrical submerged pumps</option>
                            <option key="3" value={3}>Subsea booster pumps</option>
                        </NativeSelectField>
                    </InputWrapper>
                </RowWrapper>
                <RowWrapper>
                    <NumberInputField>
                        <CaseNumberInput
                            onChange={() => { }}
                            defaultValue={caseItem.producerCount}
                            integer
                            disabled
                            label="Oil producer wells"
                        />
                    </NumberInputField>
                    <NumberInputField>
                        <CaseNumberInput
                            onChange={() => { }}
                            defaultValue={caseItem.waterInjectorCount}
                            integer
                            disabled
                            label="Water injector count"
                        />
                    </NumberInputField>
                    <CaseNumberInput
                        onChange={() => { }}
                        defaultValue={caseItem.gasInjectorCount}
                        integer
                        disabled
                        label="Gas injector count"
                    />
                </RowWrapper>
            </ColumnWrapper>
            <ColumnWrapper>
                <TableYearWrapper>
                    <NativeSelectField
                        id="unit"
                        label="Units"
                        onChange={() => { }}
                        value={project.physUnit}
                        disabled
                    >
                        <option key={0} value={0}>SI</option>
                        <option key={1} value={1}>Oil field</option>
                    </NativeSelectField>
                    <YearInputWrapper>
                        <CaseNumberInput
                            onChange={handleStartYearChange}
                            defaultValue={startYear}
                            integer
                            label="Start year"
                        />
                    </YearInputWrapper>
                    <YearDashWrapper>
                        <Typography variant="h2">-</Typography>
                    </YearDashWrapper>
                    <YearInputWrapper>
                        <CaseNumberInput
                            onChange={handleEndYearChange}
                            defaultValue={endYear}
                            integer
                            label="End year"
                        />
                    </YearInputWrapper>
                    <Button
                        onClick={handleTableYearsClick}
                    >
                        Apply
                    </Button>
                </TableYearWrapper>
            </ColumnWrapper>
            <AgChartsTimeseries
                data={productionProfilesChartData()}
                chartTitle="Production profiles"
                barColors={["#243746", "#EB0037", "#A8CED1"]}
                barProfiles={["oilProduction", "gasProduction", "waterProduction"]}
                barNames={[
                    "Oil production (MSm3)",
                    "Gas production (GSm3)",
                    "Water production (MSm3)",
                ]}
            />
            {(waterInjection !== undefined && waterInjection!.values!.length > 0)
                && (
                    <AgChartsTimeseries
                        data={injectionProfilesChartData()}
                        chartTitle="Injection profiles"
                        barColors={["#A8CED1"]}
                        barProfiles={["waterInjection"]}
                        barNames={["Water injection"]}
                        unit="MSm3"
                    />
                )}
            <CaseTabTable
                caseItem={caseItem}
                project={project}
                setCase={setCase}
                setProject={setProject}
                timeSeriesData={timeSeriesData}
                dg4Year={caseItem.DG4Date.getFullYear()}
                tableYears={tableYears}
                tableName="Production profiles"
                includeFooter={false}
                gridRef={gridRef}
            />
        </>
    )
}

export default CaseProductionProfilesTab
