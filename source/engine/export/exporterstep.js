import { FileFormat } from '../io/fileutils.js';
import { TextWriter } from '../io/textwriter.js';
import { ExportedFile, ExporterBase } from './exporterbase.js';

export class ExporterStep extends ExporterBase
{
	constructor ()
	{
		super ();
	}

    CanExport (format, extension)
    {
        return format === FileFormat.Text && extension === 'step';
    }

	ExportContent (exporterModel, format, files, onFinish)
	{
		this.ExportText (exporterModel, files);
		onFinish ();
	}

	ExportText (exporterModel, files)
	{
		let stepFile = new ExportedFile ('model.step');
		files.push (stepFile);

		let stepWriter = new TextWriter ();

		// STEP file header
		stepWriter.WriteLine ('ISO-10303-21;');
		stepWriter.WriteLine ('HEADER;');
		stepWriter.WriteLine ('FILE_DESCRIPTION((\'KreaCAD Export\'),\'2;1\');');
		stepWriter.WriteLine ('FILE_NAME(\'model.step\',\'' + new Date().toISOString() + '\',');
		stepWriter.WriteLine ('  (\'KreaCAD\'),(\'\'),\'KreaCAD v1.1.4\',\'KreaCAD\',\'\');');
		stepWriter.WriteLine ('FILE_SCHEMA((\'CONFIG_CONTROL_DESIGN\'));');
		stepWriter.WriteLine ('ENDSEC;');
		stepWriter.WriteLine ('');
		stepWriter.WriteLine ('DATA;');

		let entityId = 1;
		let vertexIds = new Map();
		let triangleIds = [];

		// Collect unique vertices
		let vertices = [];
		exporterModel.EnumerateTriangles ((v0, v1, v2) => {
			[v0, v1, v2].forEach (vertex => {
				let key = vertex.x + ',' + vertex.y + ',' + vertex.z;
				if (!vertexIds.has(key)) {
					vertexIds.set(key, entityId++);
					vertices.push({id: vertexIds.get(key), coord: vertex});
				}
			});
		});

		// Export vertices as CARTESIAN_POINTs
		vertices.forEach (vertex => {
			stepWriter.WriteLine (`#${vertex.id} = CARTESIAN_POINT('',({vertex.coord.x},{vertex.coord.y},{vertex.coord.z}));`);
		});

		// Export triangles as FACE_OUTERBOUNDs and ADVANCED_FACEs
		let faceId = entityId;
		exporterModel.EnumerateTriangles ((v0, v1, v2) => {
			let v0Key = v0.x + ',' + v0.y + ',' + v0.z;
			let v1Key = v1.x + ',' + v1.y + ',' + v1.z;
			let v2Key = v2.x + ',' + v2.y + ',' + v2.z;

			let v0Id = vertexIds.get(v0Key);
			let v1Id = vertexIds.get(v1Key);
			let v2Id = vertexIds.get(v2Key);

			// Create edge loops for triangle
			let edgeLoop1Id = entityId++;
			let edgeLoop2Id = entityId++;
			let edgeLoop3Id = entityId++;
			let faceOuterBoundId = entityId++;
			let advancedFaceId = entityId++;

			stepWriter.WriteLine (`#${edgeLoop1Id} = EDGE_LOOP('',(#${entityId},#${entityId+1},#${entityId+2}));`);
			stepWriter.WriteLine (`#${entityId++} = ORIENTED_EDGE('',*,*,#${entityId+2},.T.);`);
			stepWriter.WriteLine (`#${entityId++} = EDGE_CURVE('',#${v0Id},#${v1Id},#${entityId+2},.T.);`);
			stepWriter.WriteLine (`#${entityId++} = LINE('',#${v0Id},#${entityId+1});`);
			stepWriter.WriteLine (`#${entityId++} = VECTOR('',#${entityId+1},1.0);`);
			stepWriter.WriteLine (`#${entityId++} = DIRECTION('',(${v1.x-v0.x},${v1.y-v0.y},${v1.z-v0.z}));`);

			stepWriter.WriteLine (`#${faceOuterBoundId} = FACE_OUTER_BOUND('',#${edgeLoop1Id},.T.);`);
			stepWriter.WriteLine (`#${advancedFaceId} = ADVANCED_FACE('',(#${faceOuterBoundId}),#${entityId++},.T.);`);
			stepWriter.WriteLine (`#${entityId++} = PLANE('',#${entityId++});`);
			stepWriter.WriteLine (`#${entityId++} = AXIS2_PLACEMENT_3D('',#${v0Id},#${entityId+1},#${entityId+2});`);

			// Calculate normal vector for the triangle
			let edge1x = v1.x - v0.x, edge1y = v1.y - v0.y, edge1z = v1.z - v0.z;
			let edge2x = v2.x - v0.x, edge2y = v2.y - v0.y, edge2z = v2.z - v0.z;
			let normalX = edge1y * edge2z - edge1z * edge2y;
			let normalY = edge1z * edge2x - edge1x * edge2z;
			let normalZ = edge1x * edge2y - edge1y * edge2x;
			let normalLen = Math.sqrt(normalX*normalX + normalY*normalY + normalZ*normalZ);
			if (normalLen > 0) {
				normalX /= normalLen; normalY /= normalLen; normalZ /= normalLen;
			}

			stepWriter.WriteLine (`#${entityId++} = DIRECTION('',(${normalX},${normalY},${normalZ}));`);
			stepWriter.WriteLine (`#${entityId++} = DIRECTION('',(1.0,0.0,0.0));`);

			triangleIds.push(advancedFaceId);
			faceId = advancedFaceId + 1;
			entityId = faceId + 10; // Leave some space for intermediate entities
		});

		// Create a shell and solid
		let shellId = entityId++;
		let solidId = entityId++;
		stepWriter.WriteLine (`#${shellId} = CLOSED_SHELL('',(${triangleIds.map(id => '#' + id).join(',')}));`);
		stepWriter.WriteLine (`#${solidId} = MANIFOLD_SOLID_BREP('',#${shellId});`);

		// Basic product structure
		let productId = entityId++;
		stepWriter.WriteLine (`#${productId} = PRODUCT('KreaCAD_Model','','',());`);
		stepWriter.WriteLine (`#${entityId++} = PRODUCT_DEFINITION_FORMATION('','',#${productId});`);
		stepWriter.WriteLine (`#${entityId++} = PRODUCT_DEFINITION('','',#${entityId-1},#${entityId+1});`);
		stepWriter.WriteLine (`#${entityId++} = PRODUCT_DEFINITION_CONTEXT('',#${entityId+1},'design');`);
		stepWriter.WriteLine (`#${entityId++} = APPLICATION_CONTEXT('design');`);

		stepWriter.WriteLine ('');
		stepWriter.WriteLine ('ENDSEC;');
		stepWriter.WriteLine ('END-ISO-10303-21;');

		stepFile.SetTextContent (stepWriter.GetText ());
	}
}
