import * as service from '../../application/shared-resources/shared-resources.service.js';

function audit(req, action, file, result) {
  req.app?.locals?.securityLogger?.log('SHARED_RESOURCE_ACCESS', {
    userId: req.user?.userId,
    ip: req.ip,
    action,
    file,
    result,
  });
}

export const list = async (req, res, next, storage) => {
  try {
    const resources = await service.listResources(storage);
    audit(req, 'LIST', null, 'OK');
    res.status(200).json(resources);
  } catch (error) {
    audit(req, 'LIST', null, `ERROR_${error.status ?? 500}`);
    next(error);
  }
};

export const download = async (req, res, next, storage) => {
  try {
    const filePath = await service.getResourcePath(req.params.name, storage);
    audit(req, 'DOWNLOAD', req.params.name, 'OK');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, req.params.name, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (error) {
    audit(req, 'DOWNLOAD', req.params.name, `ERROR_${error.status ?? 500}`);
    next(error);
  }
};

export const upload = async (req, res, next, storage) => {
  try {
    const result = await service.saveResource(req.params.name, req.body, storage);
    audit(req, 'UPLOAD', req.params.name, 'OK');
    res.status(result.created ? 201 : 200).json({ name: result.name, size: result.size });
  } catch (error) {
    audit(req, 'UPLOAD', req.params.name, `ERROR_${error.status ?? 500}`);
    next(error);
  }
};

export const remove = async (req, res, next, storage) => {
  try {
    await service.deleteResource(req.params.name, storage);
    audit(req, 'DELETE', req.params.name, 'OK');
    res.status(204).end();
  } catch (error) {
    audit(req, 'DELETE', req.params.name, `ERROR_${error.status ?? 500}`);
    next(error);
  }
};
