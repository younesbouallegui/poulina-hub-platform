import { PageHeader } from "@/components/layout/PageHeader";
import { MapView } from "@/components/MapView";
import { useZabbixHosts, useZabbixProblems } from "@/lib/zabbix";
import { Globe2 } from "lucide-react";

const Maps = () => {
  const { data: hosts = [] } = useZabbixHosts();
  const { data: problems = [] } = useZabbixProblems();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Global Operations Map"
        subtitle={`${hosts.length} hosts · ${problems.length} active problems`}
        icon={Globe2}
      />
      <div className="flex-1 p-4">
        <MapView />
      </div>
    </div>
  );
};

export default Maps;
