"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, ChevronRight, Info, Save, Settings2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import useCompetitionStore from "@/utils/useCompetitionStore"
import type { RankingMethod, TiebreakerMethod } from "@/utils/useCompetitionStore"
import { toast } from "sonner"

// Define the ranking methods and their descriptions
const rankingMethods = [
  {
    id: "avg",
    name: "Average Score",
    description: "Simple average of all judges' scores",
    config: [],
  },
  {
    id: "avg-rank",
    name: "Average-Rank (AR)",
    description: "Average the scores, then rank them",
    config: [],
  },
  {
    id: "rank-avg-rank",
    name: "Rank-Average-Rank (RAR)",
    description: "Convert scores to ranks per judge, average those ranks, then rank the averages",
    config: [],
  },
  {
    id: "weighted",
    name: "Weighted Average",
    description: "Different criteria have different weights",
    config: ["weights"],
  },
  {
    id: "trimmed",
    name: "Statistical Trimming",
    description: "Remove highest and lowest scores before averaging",
    config: ["trimPercentage"],
  },
  {
    id: "median",
    name: "Median Score",
    description: "Use the median instead of average to reduce outlier impact",
    config: [],
  },
  {
    id: "borda",
    name: "Borda Count",
    description: "Points assigned based on rank (1st = n points, 2nd = n-1 points, etc.)",
    config: [],
  },
  {
    id: "custom",
    name: "Custom Formula",
    description: "Define your own ranking formula",
    config: ["formula"],
  },
]

export function RankingConfiguration() {
  const { competitionSettings, updateRankingConfig } = useCompetitionStore()
  const ranking = competitionSettings.ranking || { method: "avg", tiebreaker: "highest-score" }

  // State for the wizard
  const [step, setStep] = useState(1)
  const [selectedMethod, setSelectedMethod] = useState(ranking.method || "avg")
  const [trimPercentage, setTrimPercentage] = useState(ranking.trimPercentage || 20)
  const [useSegmentWeights, setUseSegmentWeights] = useState(ranking.useSegmentWeights || false)
  const [segmentWeights, setSegmentWeights] = useState(ranking.segmentWeights || {})
  const [tiebreaker, setTiebreaker] = useState(ranking.tiebreaker || "highest-score")
  const [tiebreakerCriterionId, setTiebreakerCriterionId] = useState(ranking.tiebreakerCriterionId || "")
  const [customFormula, setCustomFormula] = useState(ranking.customFormula || "")

  // Handle saving the configuration
  const handleSave = () => {
    const config = {
      method: selectedMethod as RankingMethod,
      trimPercentage,
      useSegmentWeights,
      segmentWeights,
      tiebreaker: tiebreaker as TiebreakerMethod,
      tiebreakerCriterionId,
      customFormula,
    }

    updateRankingConfig(config)
    toast.success("Ranking configuration saved.");
  }

  // Handle next step in wizard
  const handleNext = () => {
    setStep(step + 1)
  }

  // Handle previous step in wizard
  const handlePrevious = () => {
    setStep(step - 1)
  }

  // Render the appropriate configuration options based on the selected method
  const renderConfigOptions = () => {
    const method = rankingMethods.find((m) => m.id === selectedMethod)

    if (!method) return null

    return (
      <div className="space-y-6">
        {method.config.includes("trimPercentage") && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="trim-percentage">Trim Percentage</Label>
              <span className="text-sm text-muted-foreground">{trimPercentage}%</span>
            </div>
            <Slider
              id="trim-percentage"
              min={0}
              max={40}
              step={5}
              value={[trimPercentage]}
              onValueChange={(value) => setTrimPercentage(value[0])}
            />
            <p className="text-sm text-muted-foreground">
              This will remove the top {trimPercentage / 2}% and bottom {trimPercentage / 2}% of scores before
              averaging.
            </p>
          </div>
        )}

        {method.config.includes("formula") && (
          <div className="space-y-2">
            <Label htmlFor="custom-formula">Custom Formula</Label>
            <Input
              id="custom-formula"
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              placeholder="e.g., (avg_score * 0.7) + (median_score * 0.3)"
            />
            <p className="text-sm text-muted-foreground">
              Available variables: avg_score, median_score, min_score, max_score, judge_count
            </p>
          </div>
        )}
      </div>
    )
  }

  // Render segment weights configuration
  const renderSegmentWeights = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch id="use-segment-weights" checked={useSegmentWeights} onCheckedChange={setUseSegmentWeights} />
          <Label htmlFor="use-segment-weights">Use different weights for each segment</Label>
        </div>

        {useSegmentWeights && (
          <div className="space-y-4 mt-4">
            {competitionSettings.segments.map((segment) => (
              <div key={segment.id} className="grid grid-cols-2 gap-4 items-center">
                <Label htmlFor={`segment-${segment.id}`}>{segment.name}</Label>
                <Input
                  id={`segment-${segment.id}`}
                  type="number"
                  min="0"
                  max="100"
                  value={segmentWeights[segment.id] || 1}
                  onChange={(e) =>
                    setSegmentWeights({
                      ...segmentWeights,
                      [segment.id]: Number.parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Render tiebreaker configuration
  const renderTiebreaker = () => {
    return (
      <div className="space-y-4">
        <Label>Tiebreaker Method</Label>
        <RadioGroup value={tiebreaker} onValueChange={setTiebreaker}>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="highest-score" id="highest-score" />
            <div>
              <Label htmlFor="highest-score">Highest Individual Score</Label>
              <p className="text-sm text-muted-foreground">
                Break ties by looking at the highest individual score from any judge
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <RadioGroupItem value="head-to-head" id="head-to-head" />
            <div>
              <Label htmlFor="head-to-head">Head-to-Head Comparison</Label>
              <p className="text-sm text-muted-foreground">
                Compare how many judges ranked one contestant higher than the other
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <RadioGroupItem value="specific-criteria" id="specific-criteria" />
            <div>
              <Label htmlFor="specific-criteria">Specific Criterion</Label>
              <p className="text-sm text-muted-foreground">Break ties based on a specific criterion</p>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <RadioGroupItem value="none" id="none" />
            <div>
              <Label htmlFor="none">No Tiebreaker (Allow Ties)</Label>
              <p className="text-sm text-muted-foreground">Allow contestants to have the same rank</p>
            </div>
          </div>
        </RadioGroup>

        {tiebreaker === "specific-criteria" && (
          <div className="mt-4">
            <Label htmlFor="tiebreaker-criterion">Tiebreaker Criterion</Label>
            <Select value={tiebreakerCriterionId} onValueChange={setTiebreakerCriterionId}>
              <SelectTrigger id="tiebreaker-criterion">
                <SelectValue placeholder="Select criterion" />
              </SelectTrigger>
              <SelectContent>
                {competitionSettings.segments.flatMap((segment) =>
                  segment.criteria.map((criterion) => (
                    <SelectItem key={criterion.id} value={criterion.id}>
                      {segment.name}: {criterion.name}
                    </SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    )
  }

  // Render the wizard steps
  const renderWizardStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Step 1: Choose Ranking Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rankingMethods.map((method) => (
                <Card
                  key={method.id}
                  className={`cursor-pointer border-2 ${selectedMethod === method.id ? "border-primary" : "border-border"}`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{method.name}</h4>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                      </div>
                      {selectedMethod === method.id && <Check className="h-5 w-5 text-primary" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleNext}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Step 2: Configure Method Settings</h3>
            {renderConfigOptions()}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
              <Button onClick={handleNext}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Step 3: Segment Weights</h3>
            {renderSegmentWeights()}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
              <Button onClick={handleNext}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Step 4: Tiebreaker Rules</h3>
            {renderTiebreaker()}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
              <Button onClick={handleNext}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Step 5: Review and Save</h3>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-medium">Ranking Method</h4>
                <p>{rankingMethods.find((m) => m.id === selectedMethod)?.name}</p>
              </div>

              {selectedMethod === "trimmed" && (
                <div className="bg-muted p-4 rounded-md">
                  <h4 className="font-medium">Trim Percentage</h4>
                  <p>{trimPercentage}%</p>
                </div>
              )}

              {selectedMethod === "custom" && (
                <div className="bg-muted p-4 rounded-md">
                  <h4 className="font-medium">Custom Formula</h4>
                  <p className="font-mono text-sm">{customFormula}</p>
                </div>
              )}

              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-medium">Segment Weights</h4>
                {useSegmentWeights ? (
                  <ul className="mt-2">
                    {competitionSettings.segments.map((segment) => (
                      <li key={segment.id}>
                        {segment.name}: {segmentWeights[segment.id] || 1}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Equal weights for all segments</p>
                )}
              </div>

              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-medium">Tiebreaker Method</h4>
                <p>
                  {tiebreaker === "highest-score" && "Highest Individual Score"}
                  {tiebreaker === "head-to-head" && "Head-to-Head Comparison"}
                  {tiebreaker === "specific-criteria" && "Specific Criterion"}
                  {tiebreaker === "none" && "No Tiebreaker (Allow Ties)"}
                </p>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
              <Button onClick={handleSave}>
                Save Configuration <Save className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings2 className="mr-2 h-5 w-5" />
            Ranking Configuration
          </CardTitle>
          <CardDescription>Configure how contestants are ranked based on judges' scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <div className="flex space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  1
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  2
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  3
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  4
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 5 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  5
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Step {step} of 5</div>
            </div>
            <Separator />
          </div>

          {renderWizardStep()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            About Ranking Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="avg">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="avg">Average</TabsTrigger>
              <TabsTrigger value="rank">Rank-Based</TabsTrigger>
              <TabsTrigger value="statistical">Statistical</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="avg" className="space-y-4">
              <h3 className="font-medium">Average Score Methods</h3>
              <p>
                Average score methods calculate the final score by taking the average of all judges' scores. This is the
                simplest and most common approach.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Average Score (AVG):</strong> Simple arithmetic mean of all judges' scores.
                </li>
                <li>
                  <strong>Weighted Average:</strong> Different criteria have different weights in the final calculation.
                </li>
              </ul>
            </TabsContent>

            <TabsContent value="rank" className="space-y-4">
              <h3 className="font-medium">Rank-Based Methods</h3>
              <p>
                Rank-based methods convert scores to ranks before final calculation, which can help normalize
                differences in how judges score.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Rank-Average-Rank (RAR):</strong> Convert scores to ranks per judge, average those ranks, then
                  rank the averages.
                </li>
                <li>
                  <strong>Average-Rank (AR):</strong> Average the scores, then rank them.
                </li>
                <li>
                  <strong>Borda Count:</strong> Points assigned based on rank (1st = n points, 2nd = n-1 points, etc.).
                </li>
              </ul>
            </TabsContent>

            <TabsContent value="statistical" className="space-y-4">
              <h3 className="font-medium">Statistical Methods</h3>
              <p>
                Statistical methods use more advanced techniques to handle outliers and provide more robust results.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Statistical Trimming:</strong> Remove highest and lowest scores before averaging.
                </li>
                <li>
                  <strong>Median Score:</strong> Use the median instead of average to reduce outlier impact.
                </li>
              </ul>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <h3 className="font-medium">Custom Formula</h3>
              <p>Create your own formula for calculating final scores using a combination of different methods.</p>
              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-medium">Example Formula</h4>
                <pre className="text-sm">(avg_score * 0.7) + (median_score * 0.3)</pre>
                <p className="text-sm mt-2">
                  This formula gives 70% weight to the average score and 30% weight to the median score.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

